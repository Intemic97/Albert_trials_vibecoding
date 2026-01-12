"""
FastAPI Service for Workflow Execution API

This service receives workflow execution requests and delegates them to Prefect.
It runs independently of the frontend and provides status endpoints.
"""
import secrets
from datetime import datetime
from typing import Dict, Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

from database import Database
from flows.workflow_flow import execute_workflow_flow
import config


# ==================== FastAPI App ====================
app = FastAPI(
    title="Workflow Orchestration Service",
    description="Background workflow execution with Prefect",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Request Models ====================
class ExecuteWorkflowRequest(BaseModel):
    workflowId: str
    inputs: Optional[Dict] = {}
    organizationId: Optional[str] = None


class ExecutionStatusResponse(BaseModel):
    executionId: str
    status: str
    workflowId: str
    createdAt: str
    startedAt: Optional[str] = None
    completedAt: Optional[str] = None
    currentNodeId: Optional[str] = None
    error: Optional[str] = None
    progress: Optional[Dict] = None


# ==================== API Endpoints ====================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "service": "Workflow Orchestration Service",
        "status": "running",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/api/workflows/execute")
async def execute_workflow(request: ExecuteWorkflowRequest, background_tasks: BackgroundTasks):
    """
    Execute a workflow in the background
    
    This endpoint:
    1. Creates an execution record
    2. Schedules workflow execution with Prefect
    3. Returns immediately with execution ID
    4. User can close browser - workflow continues running
    """
    db = Database()
    
    try:
        # Verify workflow exists
        workflow = await db.get_workflow(request.workflowId)
        if not workflow:
            raise HTTPException(status_code=404, detail=f"Workflow {request.workflowId} not found")
        
        # Generate execution ID
        execution_id = secrets.token_hex(8)
        
        # Create execution record
        await db.create_execution(
            execution_id=execution_id,
            workflow_id=request.workflowId,
            organization_id=request.organizationId,
            inputs=request.inputs or {},
            status="pending"
        )
        
        print(f"📨 Received execution request for workflow {request.workflowId}")
        print(f"🆔 Execution ID: {execution_id}")
        
        # Schedule workflow execution as background task
        # This allows the API to return immediately while the workflow runs
        background_tasks.add_task(
            execute_workflow_background,
            workflow_id=request.workflowId,
            execution_id=execution_id,
            inputs=request.inputs,
            organization_id=request.organizationId
        )
        
        return {
            "success": True,
            "executionId": execution_id,
            "status": "pending",
            "message": "Workflow execution started in background",
            "workflowId": request.workflowId,
            "workflowName": workflow.get("name", "Unnamed Workflow")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error starting workflow execution: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def execute_workflow_background(
    workflow_id: str,
    execution_id: str,
    inputs: Dict,
    organization_id: Optional[str]
):
    """
    Background task that executes the workflow using Prefect
    
    This runs independently - user can close browser and it continues
    """
    try:
        print(f"🔄 Starting background execution for {execution_id}")
        
        # Execute workflow using Prefect flow
        result = await execute_workflow_flow(
            workflow_id=workflow_id,
            execution_id=execution_id,
            inputs=inputs,
            organization_id=organization_id
        )
        
        print(f"✅ Background execution completed: {execution_id}")
        
    except Exception as e:
        print(f"❌ Background execution failed: {execution_id} - {str(e)}")
        
        # Update execution to failed
        db = Database()
        await db.update_execution(execution_id, status="failed", error=str(e))


@app.get("/api/executions/{execution_id}")
async def get_execution_status(execution_id: str):
    """
    Get execution status
    
    Frontend can poll this endpoint to check progress
    """
    db = Database()
    
    execution = await db.get_execution(execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")
    
    # Get execution logs for progress
    logs = await db.get_execution_logs(execution_id)
    
    # Calculate progress
    total_nodes = len(logs)
    completed_nodes = len([l for l in logs if l["status"] == "completed"])
    failed_nodes = len([l for l in logs if l["status"] == "error"])
    
    return {
        "executionId": execution_id,
        "workflowId": execution["workflowId"],
        "status": execution["status"],
        "createdAt": execution["createdAt"],
        "startedAt": execution.get("startedAt"),
        "completedAt": execution.get("completedAt"),
        "currentNodeId": execution.get("currentNodeId"),
        "error": execution.get("error"),
        "progress": {
            "totalNodes": total_nodes,
            "completedNodes": completed_nodes,
            "failedNodes": failed_nodes,
            "percentage": int((completed_nodes / total_nodes * 100)) if total_nodes > 0 else 0
        },
        "logs": logs[-10:] if len(logs) > 10 else logs  # Last 10 logs
    }


@app.get("/api/executions/{execution_id}/logs")
async def get_execution_logs(execution_id: str):
    """Get detailed execution logs"""
    db = Database()
    
    logs = await db.get_execution_logs(execution_id)
    if not logs:
        # Check if execution exists
        execution = await db.get_execution(execution_id)
        if not execution:
            raise HTTPException(status_code=404, detail=f"Execution {execution_id} not found")
    
    return {
        "executionId": execution_id,
        "logs": logs
    }


@app.get("/api/workflows/{workflow_id}/executions")
async def get_workflow_executions(workflow_id: str, limit: int = 50):
    """Get recent executions for a workflow"""
    db = Database()
    
    # Verify workflow exists
    workflow = await db.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
    
    # Get executions (simplified - you may want to add this method to Database class)
    import aiosqlite
    async with aiosqlite.connect(config.DATABASE_PATH) as conn:
        conn.row_factory = aiosqlite.Row
        async with conn.execute(
            """
            SELECT id, workflowId, status, createdAt, startedAt, completedAt, error
            FROM workflow_executions
            WHERE workflowId = ?
            ORDER BY createdAt DESC
            LIMIT ?
            """,
            (workflow_id, limit)
        ) as cursor:
            rows = await cursor.fetchall()
            executions = [dict(row) for row in rows]
    
    return {
        "workflowId": workflow_id,
        "workflowName": workflow.get("name", "Unnamed Workflow"),
        "executions": executions,
        "total": len(executions)
    }


# ==================== Main ====================

if __name__ == "__main__":
    print("🚀 Starting Workflow Orchestration Service")
    print(f"📍 API URL: http://{config.API_HOST}:{config.API_PORT}")
    print(f"📊 Database: {config.DATABASE_PATH}")
    print(f"🔧 Prefect API: {config.PREFECT_API_URL}")
    print("")
    print("✅ Service ready to receive workflow execution requests")
    print("💡 Users can close their browser - workflows continue running!")
    print("")
    
    uvicorn.run(
        app,
        host=config.API_HOST,
        port=config.API_PORT,
        log_level="info"
    )

