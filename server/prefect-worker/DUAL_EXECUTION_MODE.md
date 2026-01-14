# 🚀 Dual Execution Mode Documentation

## Overview

The workflow system now supports **two execution modes**:

1. **Optimized Mode (Prefect DAG)** - For full workflow execution with automatic parallelization
2. **Single Node Mode** - For testing and debugging individual nodes

---

## 🎯 Mode 1: Optimized Workflow Execution

### What It Does

- Uses Prefect's native DAG (Directed Acyclic Graph) system
- Automatically detects which nodes can run in parallel
- Executes independent nodes simultaneously
- Provides intelligent retry logic per node
- Supports caching for expensive operations

### When to Use

✅ Production workflows  
✅ Long-running workflows  
✅ Workflows with parallel branches  
✅ When you need maximum performance  

### How It Works

```
User clicks "Run Workflow"
         ↓
Backend creates execution record
         ↓
Prefect analyzes workflow structure
         ↓
Groups nodes into execution layers:
  Layer 0: [Trigger]
  Layer 1: [HTTP Request]
  Layer 2: [LLM1, LLM2, LLM3]  ← Executed in PARALLEL
  Layer 3: [Join]
  Layer 4: [Output]
         ↓
Frontend polls for progress
         ↓
Results returned
```

### API Endpoint

```http
POST /api/workflow/{workflowId}/execute
Content-Type: application/json

{
  "inputs": {
    "key": "value"
  },
  "mode": "optimized"
}
```

### Response

```json
{
  "success": true,
  "executionId": "abc123def456",
  "status": "running",
  "message": "Workflow execution started in background"
}
```

### Performance Example

**Sequential (old way):**
```
Trigger(1s) → HTTP(2s) → LLM1(5s) → LLM2(5s) → LLM3(5s) → Join(1s) → Output(1s)
Total: 20 seconds
```

**Optimized (new way):**
```
Trigger(1s) → HTTP(2s) → [LLM1(5s), LLM2(5s), LLM3(5s)] → Join(1s) → Output(1s)
                          ↑ These run in PARALLEL
Total: 10 seconds (50% faster!)
```

---

## 🔧 Mode 2: Single Node Execution

### What It Does

- Executes a single node independently
- Does NOT use Prefect Flow/DAG
- Returns results immediately
- Uses mock or provided input data
- Perfect for development and testing

### When to Use

✅ Testing node configuration  
✅ Debugging specific nodes  
✅ Rapid iteration during development  
✅ Verifying API connections  
✅ Testing LLM prompts  

### How It Works

```
User clicks Play ▶️ button on node
         ↓
Frontend sends node config + input data
         ↓
Prefect executes ONLY that node handler
         ↓
Result returned immediately
         ↓
Node updates with output in UI
```

### API Endpoint

```http
POST /api/workflow/{workflowId}/execute-node
Content-Type: application/json

{
  "nodeId": "node-123",
  "nodeType": "llm",
  "node": {
    "id": "node-123",
    "type": "llm",
    "config": {
      "prompt": "Translate to Spanish",
      "model": "gpt-4"
    }
  },
  "inputData": {
    "text": "Hello world"
  }
}
```

### Response

```json
{
  "success": true,
  "nodeId": "node-123",
  "output": {
    "response": "Hola mundo"
  },
  "mode": "prefect"
}
```

---

## 🎨 Architecture Comparison

### Optimized Workflow Mode

```
┌─────────────────────────────────────────────────────────┐
│                    Optimized Flow                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend                                                │
│     ↓                                                    │
│  POST /api/workflow/123/execute                         │
│     ↓                                                    │
│  Node.js Backend (delegates)                            │
│     ↓                                                    │
│  Prefect Worker                                         │
│     ↓                                                    │
│  workflow_flow_optimized()                              │
│     │                                                    │
│     ├─ Analyze dependencies                             │
│     ├─ Create execution layers                          │
│     ├─ Execute layer 0 (sequential)                     │
│     ├─ Execute layer 1 (parallel if multiple nodes)     │
│     ├─ Execute layer 2 (parallel if multiple nodes)     │
│     └─ Complete                                         │
│                                                          │
│  Benefits:                                              │
│   ✅ Automatic parallelization                          │
│   ✅ Retry per node                                     │
│   ✅ Caching support                                    │
│   ✅ Native Prefect monitoring                          │
└─────────────────────────────────────────────────────────┘
```

### Single Node Mode

```
┌─────────────────────────────────────────────────────────┐
│                   Single Node Mode                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Frontend (click Play ▶️)                                │
│     ↓                                                    │
│  POST /api/workflow/123/execute-node                    │
│     ↓                                                    │
│  Node.js Backend (delegates)                            │
│     ↓                                                    │
│  Prefect Worker                                         │
│     ↓                                                    │
│  NODE_HANDLERS[nodeType](...)                           │
│     ↓                                                    │
│  Result returned immediately                            │
│                                                          │
│  Benefits:                                              │
│   ✅ Fast testing                                       │
│   ✅ No workflow required                               │
│   ✅ Immediate feedback                                 │
│   ✅ Easy debugging                                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Automatic Fallback

Both modes support automatic fallback to local execution if Prefect service is unavailable:

```javascript
// Backend automatically handles fallback
const prefectAvailable = await prefectClient.isAvailable();

if (prefectAvailable) {
  // Use Prefect (optimized)
  result = await prefectClient.executeWorkflow(...);
} else {
  // Fallback to local Node.js execution
  result = await localExecutor.execute(...);
}
```

---

## 📊 Comparison Table

| Feature | Optimized Mode | Single Node Mode |
|---------|----------------|------------------|
| **Execution** | Full workflow | Single node only |
| **Parallel Execution** | ✅ Yes | ❌ No |
| **Use Case** | Production | Testing/Debug |
| **Speed (parallel workflows)** | ⚡ Fast | 🐌 N/A |
| **Retry Logic** | ✅ Per node | ❌ No |
| **Caching** | ✅ Yes | ❌ No |
| **Monitoring** | ✅ Full | ⚠️ Basic |
| **Frontend Blocking** | ❌ No | ❌ No |
| **Background Execution** | ✅ Yes | ✅ Yes |

---

## 🧪 Testing Examples

### Test 1: Run Full Workflow

```bash
curl -X POST http://localhost:3001/api/workflow/wf-123/execute \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "userInput": "Hello"
    },
    "mode": "optimized"
  }'
```

### Test 2: Run Single Node

```bash
curl -X POST http://localhost:3001/api/workflow/wf-123/execute-node \
  -H "Content-Type: application/json" \
  -d '{
    "nodeId": "llm-node-1",
    "nodeType": "llm",
    "node": {
      "id": "llm-node-1",
      "type": "llm",
      "config": {
        "prompt": "Say hello",
        "model": "gpt-4"
      }
    },
    "inputData": {}
  }'
```

---

## 🎯 Migration from Legacy Mode

If you were using the old sequential execution mode:

1. **No changes needed in frontend** - API is backward compatible
2. **Automatically uses optimized mode** - Set `mode: "optimized"` (or omit, it's default)
3. **Fallback to legacy** - Set `mode: "legacy"` if needed

---

## 📝 Implementation Details

### New Files

- `server/prefect-worker/flows/workflow_flow_optimized.py` - Optimized flow with DAG
- `server/prefect-worker/DUAL_EXECUTION_MODE.md` - This documentation

### Modified Files

- `server/prefect-worker/api_service.py` - Added `/api/nodes/execute` endpoint
- `server/prefect-worker/flows/workflow_flow_optimized.py` - New optimized flow
- `server/prefectClient.js` - Added `executeNode()` method
- `server/index.js` - Updated `/execute-node` endpoint to use Prefect

### Key Functions

**Dependency Analysis:**
```python
def analyze_workflow_dependencies(nodes, connections) -> Dict[str, List[str]]
```

**Layer Grouping:**
```python
def get_execution_layers(nodes, dependencies) -> List[List[str]]
```

**Node Execution Task:**
```python
@task(name="execute_node", retries=1)
async def execute_node_task(node, input_data, execution_id, context)
```

---

## 🔍 Monitoring

### View Execution Progress

```bash
# Get execution status
curl http://localhost:3001/api/workflow/execution/abc123

# View Prefect logs
sudo journalctl -u prefect-worker -f
```

### Check Which Mode Was Used

Look for in the logs:
```
[Optimized Flow] Starting workflow execution: abc123
```

Or:
```
[WorkflowExecutor] Single node execution: node-456
```

---

## ⚡ Performance Tips

1. **Use Optimized Mode for production** - Automatic parallelization
2. **Group similar operations** - They'll run in parallel automatically
3. **Use Single Node Mode during development** - Faster iteration
4. **Monitor execution times** - Check if parallel execution is working
5. **Check logs for layer information** - See how nodes are grouped

---

## 🚨 Troubleshooting

### Nodes not running in parallel

**Check:** Do they have independent dependencies?

```
✅ Good (parallel):
  HTTP → LLM1
      → LLM2

❌ Bad (sequential):
  HTTP → LLM1 → LLM2
```

### Single node fails with "handler not found"

**Check:** Node type is supported
```python
# See: server/prefect-worker/tasks/node_handlers.py
NODE_HANDLERS = {
    'trigger': handle_trigger,
    'http': handle_http,
    'llm': handle_llm,
    # ... etc
}
```

### Execution seems slower than expected

**Check logs:**
```bash
sudo journalctl -u prefect-worker -n 100 | grep "Layer"
```

Look for: `[Optimized Flow] Execution layers: [[node1], [node2, node3], ...]`

---

## 📚 Additional Resources

- [Prefect Documentation](https://docs.prefect.io/)
- [DAG Concepts](https://en.wikipedia.org/wiki/Directed_acyclic_graph)
- `DEPLOYMENT_GUIDE.md` - Production deployment
- `QUICK_DEPLOY.md` - Quick start guide

---

**Questions?** Check the logs or reach out for support! 🚀

