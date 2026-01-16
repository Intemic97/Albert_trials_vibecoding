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
}

