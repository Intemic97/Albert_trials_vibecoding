"""
AWS Lambda Function for Python Code Execution (NO SECURITY RESTRICTIONS)
Deploy this file to AWS Lambda with Python 3.11 runtime

⚠️ WARNING: This version has NO security restrictions. Use only for trusted users.

Configuration:
- Runtime: Python 3.11
- Timeout: 30 seconds
- Memory: 512 MB
- Handler: lambda_function.lambda_handler
"""

import json
import sys
import traceback
from io import StringIO
import signal

# Timeout handler
class TimeoutError(Exception):
    pass

def timeout_handler(signum, frame):
    raise TimeoutError("Execution timed out (25 seconds)")

def lambda_handler(event, context):
    """
    Main Lambda handler
    Expected event format:
    {
        "code": "Python code string",
        "inputData": [{"key": "value"}, ...]
    }
    """
    try:
        # Set timeout (Lambda has its own timeout, but this is backup)
        signal.signal(signal.SIGALRM, timeout_handler)
        signal.alarm(25)  # 25 seconds (leave 5s buffer for Lambda)
        
        # Extract parameters
        user_code = event.get('code', '')
        input_data = event.get('inputData', [])
        
        if not user_code:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'success': False,
                    'error': 'No code provided'
                })
            }
        
        # Create execution namespace with FULL builtins (no restrictions)
        namespace = {
            '__builtins__': __builtins__,  # Full Python builtins, no restrictions
            'data': input_data
        }
        
        # Capture stdout
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = captured_output = StringIO()
        sys.stderr = captured_errors = StringIO()
        
        # Execute user code (NO SECURITY CHECKS)
        exec(user_code, namespace)
        
        # Get the process function result if it exists
        result = input_data
        if 'process' in namespace and callable(namespace['process']):
            result = namespace['process'](input_data)
        
        # Restore stdout/stderr
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        output_text = captured_output.getvalue()
        error_text = captured_errors.getvalue()
        
        # Cancel alarm
        signal.alarm(0)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'result': result,
                'output': output_text,
                'stderr': error_text if error_text else None
            })
        }
        
    except TimeoutError as e:
        signal.alarm(0)
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': False,
                'error': 'Execution timed out (25 seconds limit)'
            })
        }
    
    except Exception as e:
        signal.alarm(0)
        error_message = str(e)
        error_trace = traceback.format_exc()
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': False,
                'error': error_message,
                'traceback': error_trace
            })
        }
    
    finally:
        # Ensure stdout/stderr are restored
        sys.stdout = sys.__stdout__
        sys.stderr = sys.__stderr__
        signal.alarm(0)

