"""
Database utilities for accessing SQLite workflow data
"""
import aiosqlite
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import config

class Database:
    """Async database wrapper for SQLite"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or config.DATABASE_PATH
        self._conn = None
    
    async def connect(self):
        """Establish database connection"""
        self._conn = await aiosqlite.connect(self.db_path)
        self._conn.row_factory = aiosqlite.Row
        return self._conn
    
    async def close(self):
        """Close database connection"""
        if self._conn:
            await self._conn.close()
    
    async def get_workflow(self, workflow_id: str) -> Optional[Dict]:
        """Get workflow by ID"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM workflows WHERE id = ?", 
                (workflow_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return dict(row)
                return None
    
    async def create_execution(
        self, 
        execution_id: str,
        workflow_id: str,
        organization_id: Optional[str],
        inputs: Dict,
        status: str = "pending"
    ) -> str:
        """Create a new workflow execution record"""
        now = datetime.utcnow().isoformat()
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO workflow_executions 
                (id, workflowId, organizationId, status, inputs, createdAt)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (execution_id, workflow_id, organization_id, status, json.dumps(inputs), now))
            await db.commit()
        
        return execution_id
    
    async def update_execution(
        self,
        execution_id: str,
        status: Optional[str] = None,
        current_node_id: Optional[str] = None,
        error: Optional[str] = None,
        final_output: Optional[Dict] = None,
        node_results: Optional[Dict] = None
    ):
        """Update execution status"""
        updates = []
        params = []
        
        if status:
            updates.append("status = ?")
            params.append(status)
            
            if status == "running" and "startedAt" not in updates:
                updates.append("startedAt = ?")
                params.append(datetime.utcnow().isoformat())
            elif status in ["completed", "failed"]:
                updates.append("completedAt = ?")
                params.append(datetime.utcnow().isoformat())
        
        if current_node_id:
            updates.append("currentNodeId = ?")
            params.append(current_node_id)
        
        if error:
            updates.append("error = ?")
            params.append(error)
        
        if final_output:
            updates.append("finalOutput = ?")
            params.append(json.dumps(final_output))
        
        if node_results:
            updates.append("nodeResults = ?")
            params.append(json.dumps(node_results))
        
        params.append(execution_id)
        
        query = f"UPDATE workflow_executions SET {', '.join(updates)} WHERE id = ?"
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute(query, params)
            await db.commit()
    
    async def log_node_execution(
        self,
        execution_id: str,
        node_id: str,
        node_type: str,
        node_label: str,
        status: str,
        input_data: Optional[Dict] = None,
        output_data: Optional[Dict] = None,
        error: Optional[str] = None,
        duration: Optional[float] = None
    ):
        """Log node execution details"""
        import secrets
        log_id = secrets.token_hex(8)
        now = datetime.utcnow().isoformat()
        
        async with aiosqlite.connect(self.db_path) as db:
            await db.execute("""
                INSERT INTO execution_logs
                (id, executionId, nodeId, nodeType, nodeLabel, status, inputData, outputData, error, duration, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                log_id, execution_id, node_id, node_type, node_label, status,
                json.dumps(input_data) if input_data else None,
                json.dumps(output_data) if output_data else None,
                error, duration, now
            ))
            await db.commit()
    
    async def get_execution(self, execution_id: str) -> Optional[Dict]:
        """Get execution by ID"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM workflow_executions WHERE id = ?",
                (execution_id,)
            ) as cursor:
                row = await cursor.fetchone()
                if row:
                    return dict(row)
                return None
    
    async def get_execution_logs(self, execution_id: str) -> List[Dict]:
        """Get all logs for an execution"""
        async with aiosqlite.connect(self.db_path) as db:
            db.row_factory = aiosqlite.Row
            async with db.execute(
                "SELECT * FROM execution_logs WHERE executionId = ? ORDER BY timestamp",
                (execution_id,)
            ) as cursor:
                rows = await cursor.fetchall()
                return [dict(row) for row in rows]

