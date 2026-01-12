"""
Main Workflow Execution Flow - Orchestrates workflow execution using Prefect
"""
import json
import secrets
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from prefect import flow, task
from prefect.tasks import task_input_hash

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent))

from database import Database
from tasks.node_handlers import NODE_HANDLERS


@task(name="parse_workflow_data")
async def parse_workflow_data(workflow: Dict) -> tuple:
    """Parse workflow JSON data into nodes and connections"""
    workflow_data = json.loads(workflow["data"])
    nodes = workflow_data.get("nodes", [])
    connections = workflow_data.get("connections", [])
    return nodes, connections


@task(name="find_starting_nodes")
async def find_starting_nodes(nodes: List[Dict], connections: List[Dict]) -> List[Dict]:
    """Find nodes to start execution from"""
    # Priority 1: Trigger node
    trigger_node = next((n for n in nodes if n["type"] == "trigger"), None)
    if trigger_node:
        return [trigger_node]
    
    # Priority 2: Webhook node
    webhook_node = next((n for n in nodes if n["type"] == "webhook"), None)
    if webhook_node:
        return [webhook_node]
    
    # Priority 3: Root nodes (no incoming connections)
    nodes_with_incoming = {c["toNodeId"] for c in connections}
    root_nodes = [n for n in nodes if n["id"] not in nodes_with_incoming and n["type"] != "comment"]
    
    if root_nodes:
        return root_nodes
    
    # Fallback: Manual input nodes
    input_nodes = [n for n in nodes if n["type"] == "manualInput"]
    if input_nodes:
        return input_nodes
    
    raise ValueError("No starting nodes found in workflow")


@task(name="get_next_nodes")
async def get_next_nodes(
    node_id: str,
    nodes: List[Dict],
    connections: List[Dict],
    result: Dict
) -> List[Dict]:
    """Get next nodes to execute based on connections and conditional results"""
    outgoing = [c for c in connections if c["fromNodeId"] == node_id]
    
    # Handle conditional branching
    if "conditionResult" in result:
        condition_result = result["conditionResult"]
        filtered_connections = []
        
        for conn in outgoing:
            from_port = conn.get("fromPort", "")
            
            # True branch
            if condition_result and from_port == "true":
                filtered_connections.append(conn)
            # False branch
            elif not condition_result and from_port == "false":
                filtered_connections.append(conn)
            # Default port (no specific branch)
            elif from_port not in ["true", "false"]:
                filtered_connections.append(conn)
        
        outgoing = filtered_connections
    
    # Get target nodes
    next_node_ids = [c["toNodeId"] for c in outgoing]
    next_nodes = [n for n in nodes if n["id"] in next_node_ids]
    
    return next_nodes


@task(name="execute_node")
async def execute_node(
    node: Dict,
    input_data: Optional[Dict],
    execution_id: str,
    db: Database
) -> Dict:
    """Execute a single workflow node"""
    node_id = node["id"]
    node_type = node["type"]
    node_label = node.get("label", node_type)
    
    start_time = datetime.now()
    
    # Log node start
    await db.log_node_execution(
        execution_id=execution_id,
        node_id=node_id,
        node_type=node_type,
        node_label=node_label,
        status="running",
        input_data=input_data
    )
    
    # Update current node in execution
    await db.update_execution(execution_id, current_node_id=node_id)
    
    try:
        # Get handler for this node type
        handler = NODE_HANDLERS.get(node_type)
        
        if not handler:
            # Node type not implemented - pass through
            result = {
                "success": True,
                "message": f"Node type '{node_type}' not implemented yet",
                "outputData": input_data
            }
        else:
            # Execute node handler
            result = await handler(node, input_data)
        
        # Calculate duration
        duration = (datetime.now() - start_time).total_seconds() * 1000  # ms
        
        # Log success
        await db.log_node_execution(
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            node_label=node_label,
            status="completed",
            input_data=input_data,
            output_data=result,
            duration=duration
        )
        
        return result
        
    except Exception as e:
        # Calculate duration
        duration = (datetime.now() - start_time).total_seconds() * 1000  # ms
        
        # Log error
        await db.log_node_execution(
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            node_label=node_label,
            status="error",
            input_data=input_data,
            error=str(e),
            duration=duration
        )
        
        raise


@flow(name="execute_workflow", log_prints=True)
async def execute_workflow_flow(
    workflow_id: str,
    execution_id: str,
    inputs: Optional[Dict] = None,
    organization_id: Optional[str] = None
) -> Dict:
    """
    Main workflow execution flow
    
    This flow orchestrates the execution of a complete workflow:
    1. Loads workflow definition
    2. Finds starting nodes
    3. Executes nodes recursively following connections
    4. Handles conditional branching
    5. Updates execution status throughout
    """
    db = Database()
    inputs = inputs or {}
    node_results = {}
    
    try:
        # Load workflow
        workflow = await db.get_workflow(workflow_id)
        if not workflow:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        print(f"🚀 Starting workflow execution: {workflow.get('name', workflow_id)}")
        
        # Update status to running
        await db.update_execution(execution_id, status="running")
        
        # Parse workflow structure
        nodes, connections = await parse_workflow_data(workflow)
        print(f"📊 Workflow has {len(nodes)} nodes and {len(connections)} connections")
        
        # Apply inputs to manual input nodes
        for node in nodes:
            if node["type"] == "manualInput" and node["id"] in inputs:
                if "config" not in node:
                    node["config"] = {}
                node["config"]["inputVarValue"] = inputs[node["id"]]
        
        # Find starting nodes
        starting_nodes = await find_starting_nodes(nodes, connections)
        print(f"🎬 Starting from {len(starting_nodes)} node(s)")
        
        # Execute workflow starting from root nodes
        async def execute_from_node(node: Dict, input_data: Optional[Dict] = None):
            """Recursively execute nodes"""
            # Execute current node
            result = await execute_node(node, input_data, execution_id, db)
            node_results[node["id"]] = result
            
            # Get output data for next nodes
            output_data = result.get("outputData", input_data)
            
            # Find and execute next nodes
            next_nodes = await get_next_nodes(node["id"], nodes, connections, result)
            
            if next_nodes:
                print(f"➡️  Node '{node.get('label', node['id'])}' → {len(next_nodes)} next node(s)")
                
                # Execute next nodes sequentially
                for next_node in next_nodes:
                    await execute_from_node(next_node, output_data)
            else:
                print(f"✅ Node '{node.get('label', node['id'])}' completed (no more nodes)")
        
        # Execute from all starting nodes
        for start_node in starting_nodes:
            webhook_data = inputs.get("_webhookData") if start_node["type"] == "webhook" else None
            await execute_from_node(start_node, webhook_data)
        
        # Mark as completed
        await db.update_execution(
            execution_id,
            status="completed",
            final_output=node_results,
            node_results=node_results
        )
        
        print(f"✅ Workflow execution completed successfully")
        
        return {
            "executionId": execution_id,
            "status": "completed",
            "results": node_results
        }
        
    except Exception as e:
        print(f"❌ Workflow execution failed: {str(e)}")
        
        # Mark as failed
        await db.update_execution(
            execution_id,
            status="failed",
            error=str(e)
        )
        
        return {
            "executionId": execution_id,
            "status": "failed",
            "error": str(e)
        }

