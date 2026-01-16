#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para probar el nodo de Python
"""
import sys
import asyncio
import json

# Fix encoding for Windows console
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

from tasks.node_handlers import handle_python

async def test_python_node():
    """Test Python node with simple code"""
    
    print("=" * 60)
    print("🧪 Test 1: Simple transformation")
    print("=" * 60)
    
    # Test 1: Simple transformation
    node = {
        "id": "test_node_1",
        "type": "python",
        "config": {
            "code": """
def process(data):
    # Double all numbers in the input
    if isinstance(data, dict):
        result = {}
        for key, value in data.items():
            if isinstance(value, (int, float)):
                result[key] = value * 2
            else:
                result[key] = value
        return result
    return data
"""
        }
    }
    
    input_data = {"a": 10, "b": 20, "c": "hello"}
    
    try:
        result = await handle_python_node.fn(node, input_data)
        print("✅ Success!")
        print(f"Input: {input_data}")
        print(f"Output: {result.get('outputData')}")
        print()
    except Exception as e:
        print(f"❌ Error: {e}")
        print()
    
    print("=" * 60)
    print("🧪 Test 2: List processing")
    print("=" * 60)
    
    # Test 2: List processing
    node2 = {
        "id": "test_node_2",
        "type": "python",
        "config": {
            "code": """
def process(data):
    # Filter even numbers and square them
    if isinstance(data, list):
        return [x * x for x in data if x % 2 == 0]
    return data
"""
        }
    }
    
    input_data2 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    
    try:
        result2 = await handle_python_node.fn(node2, input_data2)
        print("✅ Success!")
        print(f"Input: {input_data2}")
        print(f"Output: {result2.get('outputData')}")
        print()
    except Exception as e:
        print(f"❌ Error: {e}")
        print()
    
    print("=" * 60)
    print("🧪 Test 3: String manipulation")
    print("=" * 60)
    
    # Test 3: String manipulation
    node3 = {
        "id": "test_node_3",
        "type": "python",
        "config": {
            "code": """
def process(data):
    # Convert to uppercase and add prefix
    if isinstance(data, dict) and 'text' in data:
        return {
            'original': data['text'],
            'transformed': data['text'].upper(),
            'length': len(data['text'])
        }
    return data
"""
        }
    }
    
    input_data3 = {"text": "hello world"}
    
    try:
        result3 = await handle_python_node.fn(node3, input_data3)
        print("✅ Success!")
        print(f"Input: {input_data3}")
        print(f"Output: {json.dumps(result3.get('outputData'), indent=2)}")
        print()
    except Exception as e:
        print(f"❌ Error: {e}")
        print()
    
    print("=" * 60)
    print("🧪 Test 4: Error handling (missing process function)")
    print("=" * 60)
    
    # Test 4: Error case
    node4 = {
        "id": "test_node_4",
        "type": "python",
        "config": {
            "code": """
# This code doesn't define a process function
x = 10
y = 20
"""
        }
    }
    
    try:
        result4 = await handle_python_node.fn(node4, {"data": "test"})
        if result4.get("success"):
            print("✅ Handled gracefully")
        else:
            print("⚠️  Expected error:")
        print(f"Message: {result4.get('message')}")
        print(f"Error: {result4.get('error')}")
        print()
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        print()
    
    print("=" * 60)
    print("✅ All tests completed!")
    print("=" * 60)

if __name__ == "__main__":
    # Import handle_python directly to avoid prefect decorator execution issues
    from tasks import node_handlers
    handle_python_node = node_handlers.handle_python
    
    asyncio.run(test_python_node())

