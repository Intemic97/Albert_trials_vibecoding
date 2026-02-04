"""
Optimized Workflow Flow with Prefect Native DAG
Uses Prefect's dependency management for parallel execution
"""

import asyncio
from datetime import datetime
from typing import Dict, List, Any, Optional
from prefect import flow, task
from prefect.futures import PrefectFuture
import aiosqlite

from tasks.node_handlers import NODE_HANDLERS
from database import Database
from config import DATABASE_PATH


def analyze_workflow_dependencies(nodes: List[Dict], connections: List[Dict]) -> Dict[str, List[str]]:
    """
    Analyze workflow to determine node dependencies
    Returns: {nodeId: [list of parent node IDs]}
    """
    dependencies = {}
    
    for node in nodes:
        node_id = node['id']
        # Find all nodes that this node depends on
        parent_nodes = [
            conn['fromNodeId'] 
            for conn in connections 
            if conn['toNodeId'] == node_id
        ]
        dependencies[node_id] = parent_nodes
    
    return dependencies


def get_execution_layers(nodes: List[Dict], dependencies: Dict[str, List[str]]) -> List[List[str]]:
    """
    Group nodes into layers for sequential execution
    Nodes in the same layer can execute in parallel
    
    Returns: [[layer0_nodes], [layer1_nodes], [layer2_nodes], ...]
    """
    layers = []
    processed = set()
    remaining = {node['id'] for node in nodes}
    
    while remaining:
        # Find nodes with no unprocessed dependencies
        current_layer = []
        for node_id in remaining:
            node_deps = dependencies.get(node_id, [])
            if all(dep in processed for dep in node_deps):
                current_layer.append(node_id)
        
        if not current_layer:
            # Circular dependency or error
            raise ValueError(f"Circular dependency detected or error in workflow structure")
        
        layers.append(current_layer)
        processed.update(current_layer)
        remaining -= set(current_layer)
    
    return layers


async def log_node_execution(
    execution_id: str,
    node_id: str,
    node_type: str,
    node_label: str,
    status: str,
    input_data: Optional[Any] = None,
    output_data: Optional[Any] = None,
    error: Optional[str] = None,
    duration: Optional[float] = None
):
    """Log node execution to database"""
    import json
    
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            INSERT INTO execution_logs 
            (id, executionId, nodeId, nodeType, nodeLabel, status, inputData, outputData, error, duration, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            f"{execution_id}_{node_id}_{datetime.now().timestamp()}",
            execution_id,
            node_id,
            node_type,
            node_label,
            status,
            json.dumps(input_data) if input_data else None,
            json.dumps(output_data) if output_data else None,
            error,
            duration,
            datetime.now().isoformat()
        ))
        await db.commit()


@task(name="execute_node", retries=1, retry_delay_seconds=5)
async def execute_node_task(
    node: Dict,
    input_data: Dict,
    execution_id: str,
    execution_context: Dict
) -> Dict:
    """
    Execute a single node as a Prefect task
    This allows Prefect to manage retries, caching, etc.
    """
    node_id = node['id']
    node_type = node['type']
    node_label = node.get('label', node_type)
    
    start_time = datetime.now()
    
    try:
        # Log start
        await log_node_execution(
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            node_label=node_label,
            status='running',
            input_data=input_data
        )
        
        # Get handler for this node type
        handler = NODE_HANDLERS.get(node_type)
        
        if not handler:
            raise ValueError(f"No handler found for node type: {node_type}")
        
        # Execute handler
        result = await handler(
            node=node,
            input_data=input_data,
            execution_context=execution_context
        )
        
        # Calculate duration
        duration = (datetime.now() - start_time).total_seconds()
        
        # Log completion
        await log_node_execution(
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            node_label=node_label,
            status='completed',
            input_data=input_data,
            output_data=result,
            duration=duration
        )
        
        return {
            'success': True,
            'nodeId': node_id,
            'output': result,
            'duration': duration
        }
        
    except Exception as e:
        duration = (datetime.now() - start_time).total_seconds()
        error_msg = str(e)
        
        # Log error
        await log_node_execution(
            execution_id=execution_id,
            node_id=node_id,
            node_type=node_type,
            node_label=node_label,
            status='failed',
            input_data=input_data,
            error=error_msg,
            duration=duration
        )
        
        return {
            'success': False,
            'nodeId': node_id,
            'error': error_msg,
            'duration': duration
        }


def merge_inputs(parent_results: List[Dict], connections: List[Dict], node_id: str) -> Dict:
    """
    Merge inputs from multiple parent nodes
    Handles regular nodes and special cases like 'join'
    """
    merged_input = {}
    
    # Find connections to this node
    incoming_connections = [c for c in connections if c['toNodeId'] == node_id]
    
    if len(incoming_connections) == 0:
        return {}
    elif len(incoming_connections) == 1:
        # Single input
        conn = incoming_connections[0]
        parent_result = next((r for r in parent_results if r['nodeId'] == conn['fromNodeId']), None)
        
        if parent_result and parent_result.get('success'):
            output = parent_result.get('output', {})
            # Handle different output formats
            if isinstance(output, dict) and 'outputData' in output:
                return output['outputData']
            return output
        return {}
    else:
        # Multiple inputs (for join nodes)
        for conn in incoming_connections:
            parent_result = next((r for r in parent_results if r['nodeId'] == conn['fromNodeId']), None)
            
            if parent_result and parent_result.get('success'):
                output = parent_result.get('output', {})
                # For join nodes, collect outputs from different branches
                output_type = conn.get('outputType', 'default')
                
                if isinstance(output, dict) and 'outputData' in output:
                    output_data = output['outputData']
                else:
                    output_data = output
                
                if output_type == 'A':
                    merged_input['inputA'] = output_data
                elif output_type == 'B':
                    merged_input['inputB'] = output_data
                else:
                    # Merge all fields
                    if isinstance(output_data, dict):
                        merged_input.update(output_data)
        
        return merged_input


@flow(name="workflow_execution_optimized", log_prints=True)
async def workflow_flow_optimized(
    workflow_id: str,
    execution_id: str,
    workflow_data: Dict,
    inputs: Dict[str, Any]
) -> Dict:
    """
    Optimized workflow execution using Prefect's native DAG
    
    Benefits:
    - Automatic parallel execution of independent nodes
    - Better error handling and retry logic
    - Caching support
    - Native Prefect monitoring
    """
    
    print(f"[Optimized Flow] Starting workflow execution: {execution_id}")
    
    nodes = workflow_data.get('nodes', [])
    connections = workflow_data.get('connections', [])
    
    # Update execution status to running
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            UPDATE workflow_executions 
            SET status = 'running', startedAt = ?
            WHERE id = ?
        """, (datetime.now().isoformat(), execution_id))
        await db.commit()
    
    try:
        # 1. Analyze dependencies
        dependencies = analyze_workflow_dependencies(nodes, connections)
        print(f"[Optimized Flow] Dependencies analyzed: {dependencies}")
        
        # 2. Group nodes into execution layers
        layers = get_execution_layers(nodes, dependencies)
        print(f"[Optimized Flow] Execution layers: {layers}")
        
        # 3. Execute layer by layer
        node_results = {}  # nodeId -> result
        
        for layer_idx, layer_node_ids in enumerate(layers):
            print(f"[Optimized Flow] Executing layer {layer_idx} with {len(layer_node_ids)} node(s): {layer_node_ids}")
            
            # Prepare tasks for this layer
            layer_tasks = []
            
            for node_id in layer_node_ids:
                node = next((n for n in nodes if n['id'] == node_id), None)
                
                if not node:
                    print(f"[Optimized Flow] Warning: Node {node_id} not found")
                    continue
                
                # Get input data from parent nodes
                parent_node_ids = dependencies.get(node_id, [])
                parent_results = [node_results[pid] for pid in parent_node_ids if pid in node_results]
                
                if parent_node_ids and not parent_results:
                    # This shouldn't happen if layers are correct
                    input_data = inputs if layer_idx == 0 else {}
                else:
                    input_data = merge_inputs(parent_results, connections, node_id)
                
                # If this is the first layer and no inputs from parents, use workflow inputs
                if layer_idx == 0 and not input_data:
                    input_data = inputs
                
                print(f"[Optimized Flow] Node {node_id} ({node['type']}) input data keys: {list(input_data.keys()) if isinstance(input_data, dict) else 'non-dict'}")
                
                # Submit task (Prefect will execute in parallel within this layer)
                task_future = execute_node_task.submit(
                    node=node,
                    input_data=input_data,
                    execution_id=execution_id,
                    execution_context={
                        'workflow_id': workflow_id,
                        'execution_id': execution_id,
                        'layer': layer_idx,
                        'mode': 'full_workflow_optimized'
                    }
                )
                
                layer_tasks.append((node_id, task_future))
            
            # Wait for all tasks in this layer to complete
            # This is where Prefect executes tasks in PARALLEL
            for node_id, task_future in layer_tasks:
                result = await task_future.result()
                node_results[node_id] = result
                
                print(f"[Optimized Flow] Node {node_id} completed: success={result.get('success')}, duration={result.get('duration')}s")
                
                # If a critical node fails, we could choose to stop here
                if not result.get('success'):
                    print(f"[Optimized Flow] Node {node_id} failed: {result.get('error')}")
                    # For now, continue execution (some branches might still succeed)
        
        # 4. Check overall success
        failed_nodes = [nid for nid, res in node_results.items() if not res.get('success')]
        
        if failed_nodes:
            final_status = 'failed'
            error_message = f"Nodes failed: {', '.join(failed_nodes)}"
        else:
            final_status = 'completed'
            error_message = None
        
        # 5. Update execution status
        async with aiosqlite.connect(DATABASE_PATH) as db:
            await db.execute("""
                UPDATE workflow_executions 
                SET status = ?, completedAt = ?, error = ?
                WHERE id = ?
            """, (final_status, datetime.now().isoformat(), error_message, execution_id))
            await db.commit()
        
        print(f"[Optimized Flow] Workflow execution completed: {final_status}")
        
        return {
            'executionId': execution_id,
            'status': final_status,
            'nodeResults': node_results,
            'failedNodes': failed_nodes,
            'totalNodes': len(nodes),
            'completedNodes': len([r for r in node_results.values() if r.get('success')])
        }
        
    except Exception as e:
        error_msg = str(e)
        print(f"[Optimized Flow] Workflow execution failed with error: {error_msg}")
        
        # Update execution status to failed
        async with aiosqlite.connect(DATABASE_PATH) as db:
            await db.execute("""
                UPDATE workflow_executions 
                SET status = 'failed', completedAt = ?, error = ?
                WHERE id = ?
            """, (datetime.now().isoformat(), error_msg, execution_id))
            await db.commit()
        
        return {
            'executionId': execution_id,
            'status': 'failed',
            'error': error_msg
        }

