"""
Node Handler Tasks - Each workflow node type has a corresponding Prefect task
"""
import json
import httpx
from typing import Dict, Any, Optional, List
from prefect import task
import config

@task(name="trigger_node", retries=0)
async def handle_trigger(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle trigger node - initiates workflow"""
    return {
        "success": True,
        "message": "Workflow triggered",
        "outputData": input_data or {}
    }

@task(name="manual_input_node", retries=0)
async def handle_manual_input(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle manual input node - provides static values"""
    config_data = node.get("config", {})
    var_name = config_data.get("inputVarName") or config_data.get("variableName", "input")
    var_value = config_data.get("inputVarValue") or config_data.get("variableValue", "")
    
    return {
        "success": True,
        "message": f"Set {var_name} = {var_value}",
        "outputData": {var_name: var_value}
    }

@task(name="output_node", retries=0)
async def handle_output(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle output node - marks final output"""
    return {
        "success": True,
        "message": "Output received",
        "outputData": input_data,
        "isFinal": True
    }

@task(name="http_request", retries=2)
async def handle_http(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle HTTP request node"""
    config_data = node.get("config", {})
    url = config_data.get("httpUrl")
    method = config_data.get("httpMethod", "GET").upper()
    
    if not url:
        raise ValueError("No URL configured for HTTP node")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        if method == "GET":
            response = await client.get(url)
        elif method == "POST":
            response = await client.post(url, json=input_data or {})
        elif method == "PUT":
            response = await client.put(url, json=input_data or {})
        elif method == "DELETE":
            response = await client.delete(url)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")
        
        response.raise_for_status()
        
        try:
            data = response.json()
        except:
            data = {"response": response.text}
        
        return {
            "success": True,
            "message": f"HTTP {method} {url} - Status {response.status_code}",
            "outputData": data,
            "statusCode": response.status_code
        }

@task(name="llm_call", retries=2)
async def handle_llm(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle LLM/OpenAI node"""
    config_data = node.get("config", {})
    prompt = config_data.get("llmPrompt") or config_data.get("prompt")
    
    if not prompt:
        raise ValueError("No prompt configured for LLM node")
    
    if not config.OPENAI_API_KEY:
        raise ValueError("OpenAI API key not configured")
    
    # Build context from input data
    context = ""
    if input_data:
        context = f"\n\nContext data:\n{json.dumps(input_data, indent=2)}"
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {config.OPENAI_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "user", "content": prompt + context}
                ]
            }
        )
        response.raise_for_status()
        result = response.json()
        
        llm_response = result["choices"][0]["message"]["content"]
        
        return {
            "success": True,
            "message": "LLM response generated",
            "outputData": {"response": llm_response, "inputData": input_data},
            "llmResponse": llm_response
        }

@task(name="condition_check", retries=0)
async def handle_condition(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle condition/branching node"""
    config_data = node.get("config", {})
    field = config_data.get("conditionField")
    operator = config_data.get("conditionOperator", "equals")
    value = config_data.get("conditionValue")
    processing_mode = config_data.get("processingMode", "batch")
    
    def evaluate_condition(actual, op, expected):
        if op == "equals":
            return str(actual) == str(expected)
        elif op == "notEquals":
            return str(actual) != str(expected)
        elif op == "contains":
            return str(expected) in str(actual)
        elif op == "greaterThan":
            return float(actual) > float(expected)
        elif op == "lessThan":
            return float(actual) < float(expected)
        elif op == "isEmpty":
            return not actual or actual == ""
        elif op == "isNotEmpty":
            return actual and actual != ""
        else:
            return str(actual) == str(expected)
    
    if processing_mode == "perRow" and isinstance(input_data, list):
        # Filter records
        true_records = [r for r in input_data if evaluate_condition(r.get(field), operator, value)]
        false_records = [r for r in input_data if not evaluate_condition(r.get(field), operator, value)]
        
        return {
            "success": True,
            "message": f"Filtered: {len(true_records)} true, {len(false_records)} false",
            "outputData": true_records,
            "conditionResult": len(true_records) > 0,
            "trueRecords": true_records,
            "falseRecords": false_records
        }
    
    # Batch mode
    test_value = input_data[0].get(field) if isinstance(input_data, list) and input_data else input_data.get(field) if isinstance(input_data, dict) else None
    result = evaluate_condition(test_value, operator, value)
    
    return {
        "success": True,
        "message": f"Condition: {field} {operator} {value} = {result}",
        "outputData": input_data,
        "conditionResult": result
    }

@task(name="add_field", retries=0)
async def handle_add_field(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle add field transformation"""
    config_data = node.get("config", {})
    field_name = config_data.get("fieldName", "newField")
    field_value = config_data.get("fieldValue", "")
    
    if isinstance(input_data, list):
        result = []
        for record in input_data:
            new_record = record.copy()
            new_record[field_name] = field_value
            result.append(new_record)
        
        return {
            "success": True,
            "message": f"Added field '{field_name}' to {len(result)} records",
            "outputData": result
        }
    
    return {
        "success": True,
        "message": f"Added field '{field_name}'",
        "outputData": {**input_data, field_name: field_value} if input_data else {field_name: field_value}
    }

@task(name="join_data", retries=0)
async def handle_join(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle data join node"""
    config_data = node.get("config", {})
    strategy = config_data.get("joinStrategy", "concat")
    join_key = config_data.get("joinKey")
    
    data_a = input_data.get("A", []) if input_data else []
    data_b = input_data.get("B", []) if input_data else []
    
    if strategy == "concat":
        result = data_a + data_b
    elif strategy == "mergeByKey" and join_key:
        result = []
        for a in data_a:
            match = next((b for b in data_b if b.get(join_key) == a.get(join_key)), None)
            result.append({**a, **match} if match else a)
    else:
        result = data_a + data_b
    
    return {
        "success": True,
        "message": f"Joined {len(data_a)} + {len(data_b)} = {len(result)} records",
        "outputData": result
    }

@task(name="webhook_receive", retries=0)
async def handle_webhook(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle webhook node - receives external data"""
    webhook_data = input_data or node.get("config", {}).get("webhookData", {})
    
    return {
        "success": True,
        "message": f"Webhook received {len(webhook_data)} fields",
        "outputData": webhook_data,
        "data": webhook_data,
        "webhookId": node.get("config", {}).get("webhookId", node.get("id")),
        "receivedAt": None  # Will be set by flow
    }

@task(name="comment_node", retries=0)
async def handle_comment(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle comment node - no operation"""
    return {
        "success": True,
        "message": "Comment node (no action)",
        "outputData": input_data
    }

@task(name="python_execution", retries=1)
async def handle_python(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """
    Handle Python code execution node
    Executes Python code with input data and returns the result
    """
    import subprocess
    import tempfile
    import base64
    import platform
    
    config_data = node.get("config", {})
    code = config_data.get("code", "")
    
    if not code:
        raise ValueError("No Python code provided")
    
    try:
        # Encode code to base64 to avoid injection
        code_base64 = base64.b64encode(code.encode('utf-8')).decode('utf-8')
        
        # Create wrapper code with security restrictions
        wrapper_code = f'''
import sys
import json
import base64
import signal

# Timeout handler
def timeout_handler(signum, frame):
    raise TimeoutError("Execution timed out (30s limit)")

# Set timeout (Unix only)
if hasattr(signal, 'alarm'):
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(30)

try:
    # Decode user code
    user_code = base64.b64decode("{code_base64}").decode('utf-8')
    
    # Create restricted globals
    restricted_globals = {{
        '__builtins__': {{
            'abs': abs, 'all': all, 'any': any, 'bool': bool, 'dict': dict,
            'enumerate': enumerate, 'filter': filter, 'float': float, 'int': int,
            'isinstance': isinstance, 'len': len, 'list': list, 'map': map,
            'max': max, 'min': min, 'print': print, 'range': range, 'reversed': reversed,
            'round': round, 'set': set, 'sorted': sorted, 'str': str, 'sum': sum,
            'tuple': tuple, 'type': type, 'zip': zip,
        }},
        'json': json,
        'math': __import__('math'),
        're': __import__('re'),
        'datetime': __import__('datetime'),
        'collections': __import__('collections'),
        'itertools': __import__('itertools'),
    }}
    restricted_locals = {{}}
    
    # Execute user code in restricted environment
    exec(user_code, restricted_globals, restricted_locals)
    
    # Read input from stdin
    input_data = json.load(sys.stdin)
    
    # Execute user function (must be named 'process')
    if 'process' in restricted_locals:
        result = restricted_locals['process'](input_data)
        print(json.dumps({{"success": True, "result": result}}))
    else:
        print(json.dumps({{"error": "Function 'process(data)' not found. Please define: def process(data): ..."}}))

except TimeoutError as e:
    print(json.dumps({{"error": str(e)}}))
except MemoryError:
    print(json.dumps({{"error": "Memory limit exceeded"}}))
except Exception as e:
    import traceback
    print(json.dumps({{"error": f"Runtime Error: {{str(e)}}", "traceback": traceback.format_exc()}}))
finally:
    # Cancel alarm
    if hasattr(signal, 'alarm'):
        try:
            signal.alarm(0)
        except:
            pass
'''
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(wrapper_code)
            temp_file = f.name
        
        try:
            # Determine Python command
            python_cmd = 'py' if platform.system() == 'Windows' else 'python3'
            
            # Execute Python script
            process = subprocess.Popen(
                [python_cmd, temp_file],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            
            # Send input data with timeout
            input_json = json.dumps(input_data or {})
            stdout, stderr = process.communicate(input=input_json, timeout=35)
            
            # Parse output
            if stdout:
                try:
                    result = json.loads(stdout.strip())
                    
                    if "error" in result:
                        return {
                            "success": False,
                            "message": f"Python execution failed: {result['error']}",
                            "error": result.get("error"),
                            "traceback": result.get("traceback"),
                            "outputData": input_data  # Pass through input on error
                        }
                    
                    return {
                        "success": True,
                        "message": "Python code executed successfully",
                        "outputData": result.get("result", {}),
                        "pythonResult": result.get("result")
                    }
                except json.JSONDecodeError:
                    # Output is not JSON, treat as string
                    return {
                        "success": True,
                        "message": "Python code executed (non-JSON output)",
                        "outputData": {"output": stdout.strip()},
                        "rawOutput": stdout.strip()
                    }
            
            if stderr:
                raise ValueError(f"Python execution error: {stderr}")
            
            raise ValueError("No output from Python execution")
            
        finally:
            # Clean up temp file
            import os
            try:
                os.unlink(temp_file)
            except:
                pass
    
    except subprocess.TimeoutExpired:
        raise ValueError("Python execution timed out (30s limit)")
    except Exception as e:
        raise ValueError(f"Python execution failed: {str(e)}")

# ==================== OT/INDUSTRIAL NODE HANDLERS ====================

@task(name="opcua_node", retries=1)
async def handle_opcua(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle OPC UA node - read data from OPC UA servers"""
    config = node.get("config", {})
    connection_id = config.get("opcuaConnectionId")
    node_ids = config.get("opcuaNodeIds", [])
    polling_interval = config.get("opcuaPollingInterval", 5000)
    
    if not connection_id or not node_ids:
        raise ValueError("OPC UA node requires connectionId and nodeIds configuration")
    
    # TODO: Implement actual OPC UA connection using asyncua library
    # For now, simulate reading from OPC UA server
    import random
    from datetime import datetime
    
    timestamp = datetime.now().isoformat()
    simulated_data = [
        {
            "nodeId": node_id,
            "value": random.random() * 100,
            "timestamp": timestamp,
            "quality": "Good"
        }
        for node_id in node_ids
    ]
    
    output_data = {
        "timestamp": timestamp,
        "values": {item["nodeId"]: item["value"] for item in simulated_data},
        "raw": simulated_data
    }
    
    return {
        "success": True,
        "message": f"Read {len(node_ids)} OPC UA nodes",
        "outputData": output_data,
        "metadata": {
            "connectionId": connection_id,
            "pollingInterval": polling_interval,
            "nodeCount": len(node_ids)
        }
    }

@task(name="mqtt_node", retries=1)
async def handle_mqtt(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle MQTT node - subscribe to MQTT topics"""
    config = node.get("config", {})
    connection_id = config.get("mqttConnectionId")
    topics = config.get("mqttTopics", [])
    qos = config.get("mqttQos", 0)
    
    if not connection_id or not topics:
        raise ValueError("MQTT node requires connectionId and topics configuration")
    
    # TODO: Implement actual MQTT subscription using aiomqtt library
    # For now, simulate receiving MQTT messages
    import random
    from datetime import datetime
    
    timestamp = datetime.now().isoformat()
    simulated_messages = [
        {
            "topic": topic,
            "payload": json.dumps({
                "value": random.random() * 100,
                "timestamp": timestamp,
                "sensorId": topic.split("/")[-1]
            }),
            "qos": qos,
            "timestamp": timestamp
        }
        for topic in topics
    ]
    
    output_data = {
        "timestamp": timestamp,
        "messages": simulated_messages,
        "topicData": {
            msg["topic"]: json.loads(msg["payload"])["value"]
            for msg in simulated_messages
        }
    }
    
    return {
        "success": True,
        "message": f"Received {len(topics)} MQTT messages",
        "outputData": output_data,
        "metadata": {
            "connectionId": connection_id,
            "qos": qos,
            "topicCount": len(topics)
        }
    }

@task(name="modbus_node", retries=1)
async def handle_modbus(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Modbus node - read data from Modbus devices"""
    config = node.get("config", {})
    connection_id = config.get("modbusConnectionId")
    addresses = config.get("modbusAddresses", [])
    function_code = config.get("modbusFunctionCode", 3)
    
    if not connection_id or not addresses:
        raise ValueError("Modbus node requires connectionId and addresses configuration")
    
    # TODO: Implement actual Modbus connection using pymodbus library
    # For now, simulate reading from Modbus device
    import random
    from datetime import datetime
    
    timestamp = datetime.now().isoformat()
    simulated_data = [
        {
            "address": addr,
            "value": random.randint(0, 65535),
            "functionCode": function_code,
            "timestamp": timestamp
        }
        for addr in addresses
    ]
    
    output_data = {
        "timestamp": timestamp,
        "registers": {item["address"]: item["value"] for item in simulated_data},
        "raw": simulated_data
    }
    
    return {
        "success": True,
        "message": f"Read {len(addresses)} Modbus registers",
        "outputData": output_data,
        "metadata": {
            "connectionId": connection_id,
            "functionCode": function_code,
            "addressCount": len(addresses)
        }
    }

@task(name="scada_node", retries=1)
async def handle_scada(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle SCADA node - fetch data from SCADA systems"""
    config = node.get("config", {})
    connection_id = config.get("scadaConnectionId")
    tags = config.get("scadaTags", [])
    polling_interval = config.get("scadaPollingInterval", 5000)
    
    if not connection_id or not tags:
        raise ValueError("SCADA node requires connectionId and tags configuration")
    
    # TODO: Implement actual SCADA connection (OPC UA/Modbus/API based)
    # For now, simulate reading SCADA tags
    import random
    from datetime import datetime
    
    timestamp = datetime.now().isoformat()
    simulated_data = [
        {
            "tag": tag,
            "value": random.random() * 100,
            "timestamp": timestamp,
            "quality": "Good"
        }
        for tag in tags
    ]
    
    output_data = {
        "timestamp": timestamp,
        "tags": {item["tag"]: item["value"] for item in simulated_data},
        "raw": simulated_data
    }
    
    return {
        "success": True,
        "message": f"Read {len(tags)} SCADA tags",
        "outputData": output_data,
        "metadata": {
            "connectionId": connection_id,
            "pollingInterval": polling_interval,
            "tagCount": len(tags)
        }
    }

@task(name="mes_node", retries=1)
async def handle_mes(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle MES node - fetch production data from MES systems"""
    config = node.get("config", {})
    connection_id = config.get("mesConnectionId")
    endpoint = config.get("mesEndpoint")
    query = config.get("mesQuery")
    
    if not connection_id or not endpoint:
        raise ValueError("MES node requires connectionId and endpoint configuration")
    
    # TODO: Implement actual MES API connection
    # For now, simulate fetching production data from MES
    from datetime import datetime
    import random
    
    timestamp = datetime.now().isoformat()
    simulated_data = {
        "productionOrder": f"PO-{int(datetime.now().timestamp())}",
        "quantity": random.randint(100, 1000),
        "status": "In Progress",
        "startTime": timestamp,
        "equipment": "Line-01",
        "operator": "Operator-123"
    }
    
    output_data = {
        "timestamp": timestamp,
        **simulated_data,
        "query": query or "production-status"
    }
    
    return {
        "success": True,
        "message": "Fetched production data from MES",
        "outputData": output_data,
        "metadata": {
            "connectionId": connection_id,
            "endpoint": endpoint,
            "query": query
        }
    }

@task(name="data_historian_node", retries=1)
async def handle_data_historian(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Data Historian node - query historical time-series data"""
    config = node.get("config", {})
    connection_id = config.get("dataHistorianConnectionId")
    tags = config.get("dataHistorianTags", [])
    start_time = config.get("dataHistorianStartTime")
    end_time = config.get("dataHistorianEndTime")
    aggregation = config.get("dataHistorianAggregation", "raw")
    
    if not connection_id or not tags:
        raise ValueError("Data Historian node requires connectionId and tags configuration")
    
    # TODO: Implement actual Data Historian query (PI/Wonderware/InfluxDB)
    # For now, simulate historical time-series data
    from datetime import datetime, timedelta
    import random
    
    if not start_time:
        start_time = (datetime.now() - timedelta(days=1)).isoformat()
    if not end_time:
        end_time = datetime.now().isoformat()
    
    start = datetime.fromisoformat(start_time.replace("Z", "+00:00").replace("+00:00", ""))
    end = datetime.fromisoformat(end_time.replace("Z", "+00:00").replace("+00:00", ""))
    
    interval = timedelta(minutes=1) if aggregation == "raw" else timedelta(hours=1)
    data_points = []
    current = start
    
    while current <= end:
        for tag in tags:
            data_points.append({
                "tag": tag,
                "timestamp": current.isoformat(),
                "value": random.random() * 100
            })
        current += interval
    
    output_data = {
        "startTime": start_time,
        "endTime": end_time,
        "aggregation": aggregation,
        "dataPoints": data_points,
        "tags": {
            tag: [
                {"timestamp": dp["timestamp"], "value": dp["value"]}
                for dp in data_points if dp["tag"] == tag
            ]
            for tag in tags
        }
    }
    
    return {
        "success": True,
        "message": f"Queried {len(data_points)} historical data points for {len(tags)} tags",
        "outputData": output_data,
        "metadata": {
            "connectionId": connection_id,
            "tagCount": len(tags),
            "pointCount": len(data_points),
            "aggregation": aggregation
        }
    }

@task(name="time_series_aggregator_node", retries=0)
async def handle_time_series_aggregator(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Time-Series Aggregator node - aggregate time-series data"""
    config = node.get("config", {})
    aggregation_type = config.get("timeSeriesAggregationType", "avg")
    interval = config.get("timeSeriesInterval", "5m")
    fields = config.get("timeSeriesFields", [])
    
    if not input_data:
        return {
            "success": True,
            "message": "No data to aggregate",
            "outputData": {}
        }
    
    # TODO: Implement proper time-series aggregation
    # For now, simple aggregation logic
    import statistics
    from datetime import datetime
    
    if isinstance(input_data, list):
        # Aggregate array of data points
        if not input_data:
            return {
                "success": True,
                "message": "No data to aggregate",
                "outputData": {}
            }
        
        # Simple aggregation by field
        aggregated = {}
        for field in fields if fields else input_data[0].keys():
            if field not in ["timestamp", "createdAt"]:
                values = [float(item.get(field, 0)) for item in input_data if field in item]
                if values:
                    if aggregation_type == "avg":
                        aggregated[field] = statistics.mean(values)
                    elif aggregation_type == "min":
                        aggregated[field] = min(values)
                    elif aggregation_type == "max":
                        aggregated[field] = max(values)
                    elif aggregation_type == "sum":
                        aggregated[field] = sum(values)
                    elif aggregation_type == "count":
                        aggregated[field] = len(values)
        
        return {
            "success": True,
            "message": f"Aggregated {len(input_data)} data points using {aggregation_type}",
            "outputData": aggregated,
            "metadata": {
                "aggregationType": aggregation_type,
                "interval": interval,
                "inputCount": len(input_data)
            }
        }
    else:
        # Single data point - return as-is
        timestamp = input_data.get("timestamp", datetime.now().isoformat())
        output_data = {k: v for k, v in input_data.items() if k != "timestamp"}
        
        return {
            "success": True,
            "message": f"Processed time-series data point",
            "outputData": {
                "timestamp": timestamp,
                "interval": interval,
                **output_data
            },
            "metadata": {
                "aggregationType": aggregation_type,
                "interval": interval
            }
        }

# ==================== DATA SOURCE NODE HANDLERS ====================

@task(name="fetch_data", retries=1)
async def handle_fetch_data(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle fetchData node - fetch records from an entity"""
    import aiosqlite
    
    config_data = node.get("config", {})
    entity_id = config_data.get("entityId") or config_data.get("selectedEntityId")
    
    if not entity_id:
        raise ValueError("No entity configured for fetchData node")
    
    db_path = execution_context.get("db_path", "../database.sqlite") if execution_context else "../database.sqlite"
    
    async with aiosqlite.connect(db_path) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT r.id, r.createdAt, rv.propertyId, rv.value
            FROM records r
            LEFT JOIN record_values rv ON r.id = rv.recordId
            WHERE r.entityId = ?
        """, [entity_id])
        rows = await cursor.fetchall()
        
        # Group by record
        record_map = {}
        for row in rows:
            record_id = row['id']
            if record_id not in record_map:
                record_map[record_id] = {'id': record_id, 'createdAt': row['createdAt']}
            if row['propertyId']:
                record_map[record_id][row['propertyId']] = row['value']
        
        data = list(record_map.values())
    
    return {
        "success": True,
        "message": f"Fetched {len(data)} records",
        "outputData": data,
        "recordCount": len(data)
    }

@task(name="excel_input", retries=0)
async def handle_excel_input(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Excel/CSV input node"""
    import pandas as pd
    import io
    
    config_data = node.get("config", {})
    
    # Check for GCS path first (preferred for large files)
    if config_data.get("gcsPath"):
        from gcs_service import gcs_service
        
        gcs_available = gcs_service.init()
        if not gcs_available:
            raise ValueError("Cloud storage not available for loading Excel data")
        
        result = gcs_service.download_workflow_data(config_data["gcsPath"])
        
        if not result["success"]:
            raise ValueError(f"Failed to load Excel data from cloud: {result['error']}")
        
        data = result["data"]
        row_count = result["row_count"]
        
        return {
            "success": True,
            "message": f"Loaded {row_count} rows from {config_data.get('fileName', 'cloud storage')} (GCS)",
            "outputData": data,
            "rowCount": row_count,
            "source": "gcs"
        }
    
    # Fallback: use inline parsedData (already processed in frontend)
    if config_data.get("parsedData") and isinstance(config_data["parsedData"], list):
        return {
            "success": True,
            "message": f"Loaded {len(config_data['parsedData'])} rows from {config_data.get('fileName', 'file')}",
            "outputData": config_data["parsedData"],
            "rowCount": len(config_data["parsedData"]),
            "source": "inline"
        }
    
    raise ValueError("No data configured for Excel/CSV node. Please upload a file.")

@task(name="pdf_input", retries=0)
async def handle_pdf_input(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle PDF input node"""
    config_data = node.get("config", {})
    
    # Check for GCS path first (preferred for large PDFs)
    if config_data.get("gcsPath") and config_data.get("useGCS"):
        from gcs_service import gcs_service
        
        gcs_available = gcs_service.init()
        if not gcs_available:
            raise ValueError("Cloud storage not available for loading PDF data")
        
        result = gcs_service.download_workflow_data(config_data["gcsPath"])
        
        if not result["success"]:
            raise ValueError(f"Failed to load PDF from cloud: {result['error']}")
        
        pdf_data = result["data"]
        return {
            "success": True,
            "message": f"Loaded PDF: {pdf_data.get('fileName', config_data.get('fileName', 'file'))} ({pdf_data.get('pages', '?')} pages) from GCS",
            "outputData": {
                "text": pdf_data.get("text", ""),
                "fileName": pdf_data.get("fileName", config_data.get("fileName")),
                "pages": pdf_data.get("pages")
            },
            "source": "gcs"
        }
    
    # Fallback: use inline text (pdfText or parsedText)
    pdf_text = config_data.get("pdfText") or config_data.get("parsedText")
    if pdf_text:
        return {
            "success": True,
            "message": f"Loaded PDF: {config_data.get('fileName', 'file')} ({config_data.get('pages', '?')} pages)",
            "outputData": {
                "text": pdf_text,
                "fileName": config_data.get("fileName"),
                "pages": config_data.get("pages")
            },
            "source": "inline"
        }
    
    raise ValueError("No PDF data configured. Please upload a PDF file.")

@task(name="save_records", retries=1)
async def handle_save_records(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle saveRecords node - save data to database"""
    import aiosqlite
    import uuid
    from datetime import datetime
    
    config_data = node.get("config", {})
    table_name = config_data.get("tableName") or config_data.get("entityName", "saved_records")
    mode = config_data.get("saveMode", "insert")
    
    db_path = execution_context.get("db_path", "../database.sqlite") if execution_context else "../database.sqlite"
    
    records = input_data if isinstance(input_data, list) else [input_data] if input_data else []
    saved_ids = []
    
    async with aiosqlite.connect(db_path) as db:
        # Create table if not exists
        await db.execute(f"""
            CREATE TABLE IF NOT EXISTS {table_name} (
                id TEXT PRIMARY KEY,
                data TEXT,
                workflowId TEXT,
                executionId TEXT,
                createdAt TEXT,
                updatedAt TEXT
            )
        """)
        
        now = datetime.now().isoformat()
        workflow_id = execution_context.get("workflow_id") if execution_context else None
        execution_id = execution_context.get("execution_id") if execution_context else None
        
        for record in records:
            record_id = record.get("id") if isinstance(record, dict) else None
            if not record_id:
                record_id = str(uuid.uuid4())[:16]
            
            await db.execute(f"""
                INSERT OR REPLACE INTO {table_name} (id, data, workflowId, executionId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?)
            """, [record_id, json.dumps(record), workflow_id, execution_id, now, now])
            
            saved_ids.append(record_id)
        
        await db.commit()
    
    return {
        "success": True,
        "message": f"Saved {len(saved_ids)} record(s) to '{table_name}'",
        "outputData": input_data,
        "savedIds": saved_ids,
        "tableName": table_name
    }

# ==================== INTEGRATION NODE HANDLERS ====================

@task(name="mysql_query", retries=1)
async def handle_mysql(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle MySQL query node"""
    import mysql.connector
    
    config_data = node.get("config", {})
    query = config_data.get("mysqlQuery")
    
    if not query:
        raise ValueError("No query configured for MySQL node")
    
    try:
        conn = mysql.connector.connect(
            host=config_data.get("mysqlHost", "localhost"),
            port=int(config_data.get("mysqlPort", 3306)),
            database=config_data.get("mysqlDatabase"),
            user=config_data.get("mysqlUsername"),
            password=config_data.get("mysqlPassword"),
            connect_timeout=10
        )
        
        cursor = conn.cursor(dictionary=True)
        cursor.execute(query)
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": f"MySQL query returned {len(rows)} rows",
            "outputData": rows,
            "rowCount": len(rows)
        }
    except Exception as e:
        raise ValueError(f"MySQL query failed: {str(e)}")

@task(name="send_email", retries=2)
async def handle_send_email(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle email sending node"""
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    
    config_data = node.get("config", {})
    email_to = config_data.get("emailTo")
    email_subject = config_data.get("emailSubject", "(No subject)")
    email_body = config_data.get("emailBody", "")
    smtp_host = config_data.get("emailSmtpHost", "smtp.gmail.com")
    smtp_port = int(config_data.get("emailSmtpPort", 587))
    smtp_user = config_data.get("emailSmtpUser")
    smtp_pass = config_data.get("emailSmtpPass")
    
    if not email_to or not smtp_user or not smtp_pass:
        raise ValueError("Email configuration incomplete")
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = email_subject
        msg["From"] = smtp_user
        msg["To"] = email_to
        
        text_part = MIMEText(email_body, "plain")
        html_part = MIMEText(email_body.replace("\n", "<br>"), "html")
        msg.attach(text_part)
        msg.attach(html_part)
        
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, email_to, msg.as_string())
        
        return {
            "success": True,
            "message": f"Email sent to {email_to}",
            "outputData": input_data
        }
    except Exception as e:
        raise ValueError(f"Failed to send email: {str(e)}")

@task(name="send_sms", retries=2)
async def handle_send_sms(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle SMS sending node via Twilio"""
    config_data = node.get("config", {})
    sms_to = config_data.get("smsTo")
    sms_body = config_data.get("smsBody", "")
    account_sid = config_data.get("twilioAccountSid") or config.TWILIO_ACCOUNT_SID
    auth_token = config_data.get("twilioAuthToken") or config.TWILIO_AUTH_TOKEN
    from_number = config_data.get("twilioFromNumber")
    
    if not sms_to or not account_sid or not auth_token or not from_number:
        raise ValueError("SMS configuration incomplete. Please provide Twilio credentials and phone numbers.")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json",
                auth=(account_sid, auth_token),
                data={
                    "To": sms_to,
                    "From": from_number,
                    "Body": sms_body
                }
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "success": True,
                "message": f"SMS sent to {sms_to}",
                "outputData": input_data,
                "messageSid": result.get("sid"),
                "status": result.get("status")
            }
    except Exception as e:
        raise ValueError(f"Failed to send SMS: {str(e)}")

@task(name="data_visualization", retries=0)
async def handle_data_visualization(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle data visualization node - pass through data"""
    config_data = node.get("config", {})
    generated_widget = config_data.get("generatedWidget")
    visualization_prompt = config_data.get("visualizationPrompt")
    
    return {
        "success": True,
        "message": f"Visualization: {generated_widget.get('title', 'Untitled')}" if generated_widget else "Visualization node (configure in editor)",
        "outputData": input_data,
        "widget": generated_widget,
        "prompt": visualization_prompt
    }

@task(name="esios_fetch", retries=2)
async def handle_esios(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle ESIOS (Spanish electricity market) data fetch"""
    config_data = node.get("config", {})
    archive_id = config_data.get("esiosArchiveId")
    
    if not archive_id:
        raise ValueError("No ESIOS archive ID configured")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://api.esios.ree.es/archives/{archive_id}/download",
                headers={"Accept": "application/json"}
            )
            response.raise_for_status()
            data = response.json()
            
            return {
                "success": True,
                "message": "ESIOS data fetched",
                "outputData": data
            }
    except Exception as e:
        raise ValueError(f"ESIOS request failed: {str(e)}")

@task(name="climatiq_fetch", retries=2)
async def handle_climatiq(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Climatiq emissions data fetch"""
    config_data = node.get("config", {})
    query = config_data.get("climatiqQuery")
    
    if not query:
        raise ValueError("No Climatiq query configured")
    
    api_key = config.CLIMATIQ_API_KEY
    if not api_key:
        raise ValueError("Climatiq API key not configured")
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"https://beta3.api.climatiq.io/search?query={query}",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                }
            )
            response.raise_for_status()
            data = response.json()
            
            return {
                "success": True,
                "message": "Climatiq data fetched",
                "outputData": data
            }
    except Exception as e:
        raise ValueError(f"Climatiq request failed: {str(e)}")

@task(name="split_columns", retries=0)
async def handle_split_columns(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle split columns node - split data into two outputs"""
    config_data = node.get("config", {})
    columns_a = config_data.get("columnsOutputA", [])
    columns_b = config_data.get("columnsOutputB", [])
    
    if not isinstance(input_data, list):
        return {
            "success": True,
            "message": "No array data to split",
            "outputData": input_data
        }
    
    output_a = []
    output_b = []
    
    for record in input_data:
        filtered_a = {col: record[col] for col in columns_a if col in record}
        filtered_b = {col: record[col] for col in columns_b if col in record}
        output_a.append(filtered_a)
        output_b.append(filtered_b)
    
    return {
        "success": True,
        "message": f"Split into {len(columns_a)} and {len(columns_b)} columns",
        "outputData": output_a,
        "outputA": output_a,
        "outputB": output_b
    }

@task(name="human_approval", retries=0)
async def handle_human_approval(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle human approval node - pauses workflow for human input"""
    # In Python/Prefect, we mark the execution as paused
    # The frontend will need to poll for this status
    return {
        "success": True,
        "message": "Waiting for human approval",
        "outputData": input_data,
        "requiresApproval": True,
        "paused": True
    }

@task(name="send_discord", retries=2)
async def handle_send_discord(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Discord webhook message sending node"""
    config_data = node.get("config", {})
    
    webhook_url = config_data.get("discordWebhookUrl")
    message = config_data.get("discordMessage", "")
    username = config_data.get("discordUsername", "Workflow Bot")
    avatar_url = config_data.get("discordAvatarUrl")
    embed_title = config_data.get("discordEmbedTitle")
    embed_color = config_data.get("discordEmbedColor", "5865F2")  # Discord blurple
    
    if not webhook_url:
        raise ValueError("Discord webhook URL not configured")
    
    if not message and not embed_title:
        raise ValueError("Discord message or embed title is required")
    
    # Replace placeholders in message with input data
    if input_data and isinstance(input_data, dict):
        for key, value in input_data.items():
            placeholder = f"{{{{{key}}}}}"
            if message and placeholder in message:
                message = message.replace(placeholder, str(value))
            if embed_title and placeholder in embed_title:
                embed_title = embed_title.replace(placeholder, str(value))
    
    # Build Discord payload
    payload = {
        "username": username,
    }
    
    if message:
        payload["content"] = message
    
    if avatar_url:
        payload["avatar_url"] = avatar_url
    
    # Add embed if we have structured data or embed title
    if embed_title or (input_data and isinstance(input_data, dict)):
        embed = {
            "color": int(embed_color.lstrip('#'), 16) if embed_color else 0x5865F2,
            "timestamp": datetime.now().isoformat()
        }
        
        if embed_title:
            embed["title"] = embed_title
        
        if input_data and isinstance(input_data, dict):
            fields = []
            for key, value in input_data.items():
                if key not in ["_webhookData", "response"]:
                    fields.append({
                        "name": key,
                        "value": str(value)[:1024],
                        "inline": True
                    })
            if fields:
                embed["fields"] = fields[:25]  # Discord max 25 fields
        
        payload["embeds"] = [embed]
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code not in [200, 204]:
                raise ValueError(f"Discord API error: {response.text}")
            
            return {
                "success": True,
                "message": "Discord message sent successfully",
                "outputData": input_data
            }
    except Exception as e:
        raise ValueError(f"Failed to send Discord message: {str(e)}")

@task(name="send_teams", retries=2)
async def handle_send_teams(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Microsoft Teams webhook message sending node"""
    config_data = node.get("config", {})
    
    webhook_url = config_data.get("teamsWebhookUrl")
    message = config_data.get("teamsMessage", "")
    title = config_data.get("teamsTitle", "Workflow Notification")
    theme_color = config_data.get("teamsThemeColor", "0078D4")  # Microsoft blue
    
    if not webhook_url:
        raise ValueError("Teams webhook URL not configured")
    
    if not message:
        raise ValueError("Teams message is empty")
    
    # Replace placeholders in message with input data
    if input_data and isinstance(input_data, dict):
        for key, value in input_data.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in message:
                message = message.replace(placeholder, str(value))
            if placeholder in title:
                title = title.replace(placeholder, str(value))
    
    # Build Teams Adaptive Card payload
    payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": theme_color.lstrip('#'),
        "summary": title,
        "sections": [{
            "activityTitle": title,
            "text": message,
            "markdown": True
        }]
    }
    
    # Add facts if we have structured data
    if input_data and isinstance(input_data, dict):
        facts = []
        for key, value in input_data.items():
            if key not in ["_webhookData", "response"]:
                facts.append({
                    "name": key,
                    "value": str(value)[:500]
                })
        if facts:
            payload["sections"][0]["facts"] = facts[:10]
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                raise ValueError(f"Teams API error: {response.text}")
            
            return {
                "success": True,
                "message": "Teams message sent successfully",
                "outputData": input_data
            }
    except Exception as e:
        raise ValueError(f"Failed to send Teams message: {str(e)}")

@task(name="google_sheets", retries=2)
async def handle_google_sheets(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Google Sheets read/write operations"""
    config_data = node.get("config", {})
    
    api_key = config_data.get("googleApiKey") or os.getenv("GOOGLE_API_KEY")
    spreadsheet_id = config_data.get("spreadsheetId")
    sheet_range = config_data.get("sheetRange", "Sheet1!A1:Z1000")
    operation = config_data.get("operation", "read")  # read, append, write
    
    if not spreadsheet_id:
        raise ValueError("Google Sheets spreadsheet ID not configured")
    
    base_url = "https://sheets.googleapis.com/v4/spreadsheets"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            if operation == "read":
                # Read data from sheet
                url = f"{base_url}/{spreadsheet_id}/values/{sheet_range}"
                params = {"key": api_key} if api_key else {}
                
                response = await client.get(url, params=params)
                
                if response.status_code != 200:
                    raise ValueError(f"Google Sheets API error: {response.text}")
                
                data = response.json()
                values = data.get("values", [])
                
                # Convert to list of dicts using first row as headers
                if len(values) > 1:
                    headers = values[0]
                    records = []
                    for row in values[1:]:
                        record = {}
                        for i, header in enumerate(headers):
                            record[header] = row[i] if i < len(row) else ""
                        records.append(record)
                    output_data = records
                else:
                    output_data = values
                
                return {
                    "success": True,
                    "message": f"Read {len(values)} rows from Google Sheets",
                    "outputData": output_data,
                    "rowCount": len(values)
                }
            
            elif operation in ["append", "write"]:
                # Write data to sheet
                if not input_data:
                    raise ValueError("No data to write to Google Sheets")
                
                # Convert input data to 2D array
                if isinstance(input_data, list) and len(input_data) > 0:
                    if isinstance(input_data[0], dict):
                        headers = list(input_data[0].keys())
                        values = [headers]
                        for record in input_data:
                            values.append([str(record.get(h, "")) for h in headers])
                    else:
                        values = input_data
                elif isinstance(input_data, dict):
                    headers = list(input_data.keys())
                    values = [headers, [str(v) for v in input_data.values()]]
                else:
                    values = [[str(input_data)]]
                
                endpoint = "append" if operation == "append" else "update"
                url = f"{base_url}/{spreadsheet_id}/values/{sheet_range}:{endpoint}"
                params = {
                    "valueInputOption": "USER_ENTERED",
                    "key": api_key
                } if api_key else {"valueInputOption": "USER_ENTERED"}
                
                response = await client.post(
                    url,
                    params=params,
                    json={"values": values}
                )
                
                if response.status_code not in [200, 201]:
                    raise ValueError(f"Google Sheets API error: {response.text}")
                
                return {
                    "success": True,
                    "message": f"{'Appended' if operation == 'append' else 'Wrote'} {len(values)} rows to Google Sheets",
                    "outputData": input_data,
                    "rowCount": len(values)
                }
            
            else:
                raise ValueError(f"Unknown operation: {operation}")
                
    except Exception as e:
        raise ValueError(f"Google Sheets operation failed: {str(e)}")

@task(name="send_telegram", retries=2)
async def handle_send_telegram(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Telegram message sending node"""
    config_data = node.get("config", {})
    
    bot_token = config_data.get("telegramBotToken") or os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = config_data.get("telegramChatId")
    message = config_data.get("telegramMessage", "")
    parse_mode = config_data.get("telegramParseMode", "HTML")  # HTML or Markdown
    
    if not bot_token:
        raise ValueError("Telegram bot token not configured")
    
    if not chat_id:
        raise ValueError("Telegram chat ID not configured")
    
    if not message:
        raise ValueError("Telegram message is empty")
    
    # Replace placeholders in message with input data
    if input_data and isinstance(input_data, dict):
        for key, value in input_data.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in message:
                message = message.replace(placeholder, str(value))
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": parse_mode
            }
            
            response = await client.post(url, json=payload)
            
            if response.status_code != 200:
                error_data = response.json()
                raise ValueError(f"Telegram API error: {error_data.get('description', response.text)}")
            
            result = response.json()
            
            return {
                "success": True,
                "message": f"Telegram message sent to chat {chat_id}",
                "outputData": input_data,
                "messageId": result.get("result", {}).get("message_id")
            }
    except Exception as e:
        raise ValueError(f"Failed to send Telegram message: {str(e)}")

@task(name="send_slack", retries=2)
async def handle_send_slack(node: Dict, input_data: Optional[Dict] = None, execution_context: Optional[Dict] = None) -> Dict:
    """Handle Slack message sending node"""
    config_data = node.get("config", {})
    
    webhook_url = config_data.get("slackWebhookUrl")
    channel = config_data.get("slackChannel")
    message = config_data.get("slackMessage", "")
    username = config_data.get("slackUsername", "Workflow Bot")
    icon_emoji = config_data.get("slackIconEmoji", ":robot_face:")
    
    if not webhook_url:
        raise ValueError("Slack webhook URL not configured")
    
    if not message:
        raise ValueError("Slack message is empty")
    
    # Replace placeholders in message with input data
    if input_data and isinstance(input_data, dict):
        for key, value in input_data.items():
            placeholder = f"{{{{{key}}}}}"
            if placeholder in message:
                message = message.replace(placeholder, str(value))
    
    # Build Slack payload
    payload = {
        "text": message,
        "username": username,
        "icon_emoji": icon_emoji
    }
    
    if channel:
        payload["channel"] = channel
    
    # Add attachments if we have structured data
    if input_data and isinstance(input_data, dict):
        fields = []
        for key, value in input_data.items():
            if key not in ["_webhookData", "response"]:  # Skip internal fields
                fields.append({
                    "title": key,
                    "value": str(value)[:100],  # Limit length
                    "short": True
                })
        
        if fields:
            payload["attachments"] = [{
                "color": "#36a64f",
                "fields": fields[:10]  # Max 10 fields
            }]
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                webhook_url,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                raise ValueError(f"Slack API error: {response.text}")
            
            return {
                "success": True,
                "message": f"Slack message sent{' to ' + channel if channel else ''}",
                "outputData": input_data,
                "slackResponse": response.text
            }
    except Exception as e:
        raise ValueError(f"Failed to send Slack message: {str(e)}")

# Export all handlers
NODE_HANDLERS = {
    "trigger": handle_trigger,
    "manualInput": handle_manual_input,
    "output": handle_output,
    "http": handle_http,
    "llm": handle_llm,
    "condition": handle_condition,
    "addField": handle_add_field,
    "join": handle_join,
    "webhook": handle_webhook,
    "comment": handle_comment,
    "python": handle_python,
    # Data source nodes
    "fetchData": handle_fetch_data,
    "excelInput": handle_excel_input,
    "pdfInput": handle_pdf_input,
    "saveRecords": handle_save_records,
    # Integration nodes
    "mysql": handle_mysql,
    "sendEmail": handle_send_email,
    "sendSMS": handle_send_sms,
    "sendSlack": handle_send_slack,
    "sendDiscord": handle_send_discord,
    "sendTeams": handle_send_teams,
    "sendTelegram": handle_send_telegram,
    "googleSheets": handle_google_sheets,
    "dataVisualization": handle_data_visualization,
    "esios": handle_esios,
    "climatiq": handle_climatiq,
    # Logic nodes
    "splitColumns": handle_split_columns,
    "humanApproval": handle_human_approval,
    # OT/Industrial nodes
    "opcua": handle_opcua,
    "mqtt": handle_mqtt,
    "modbus": handle_modbus,
    "scada": handle_scada,
    "mes": handle_mes,
    "dataHistorian": handle_data_historian,
    "timeSeriesAggregator": handle_time_series_aggregator,
}

