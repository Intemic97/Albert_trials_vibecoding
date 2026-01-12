"""
Test script to verify Prefect service is working correctly
"""
import asyncio
import httpx
from datetime import datetime

BASE_URL = "http://localhost:8000"

async def test_health_check():
    """Test 1: Health check"""
    print("=" * 60)
    print("Test 1: Health Check")
    print("=" * 60)
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{BASE_URL}/")
            data = response.json()
            
            print(f"✅ Service is running!")
            print(f"   Service: {data.get('service')}")
            print(f"   Status: {data.get('status')}")
            print(f"   Version: {data.get('version')}")
            print()
            return True
        except Exception as e:
            print(f"❌ Health check failed: {e}")
            print()
            return False


async def test_database_connection():
    """Test 2: Database connection"""
    print("=" * 60)
    print("Test 2: Database Connection")
    print("=" * 60)
    
    try:
        from database import Database
        db = Database()
        
        # Try to get a workflow (any workflow)
        import aiosqlite
        import config
        
        async with aiosqlite.connect(config.DATABASE_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute("SELECT COUNT(*) as count FROM workflows") as cursor:
                row = await cursor.fetchone()
                workflow_count = row['count'] if row else 0
        
        print(f"✅ Database connection successful!")
        print(f"   Database: {config.DATABASE_PATH}")
        print(f"   Workflows in database: {workflow_count}")
        print()
        return True
        
    except Exception as e:
        print(f"❌ Database connection failed: {e}")
        print()
        return False


async def test_mock_workflow_execution():
    """Test 3: Mock workflow execution (if workflows exist)"""
    print("=" * 60)
    print("Test 3: Mock Workflow Execution")
    print("=" * 60)
    
    try:
        from database import Database
        import aiosqlite
        import config
        
        # Get first workflow
        async with aiosqlite.connect(config.DATABASE_PATH) as conn:
            conn.row_factory = aiosqlite.Row
            async with conn.execute("SELECT * FROM workflows LIMIT 1") as cursor:
                row = await cursor.fetchone()
                workflow = dict(row) if row else None
        
        if not workflow:
            print("⚠️  No workflows in database - skipping execution test")
            print("   Create a workflow in the frontend first")
            print()
            return True
        
        print(f"Found workflow: {workflow.get('name', 'Unnamed')}")
        print(f"Workflow ID: {workflow['id']}")
        
        # Test API endpoint
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(
                f"{BASE_URL}/api/workflows/execute",
                json={
                    "workflowId": workflow["id"],
                    "inputs": {},
                    "organizationId": workflow.get("organizationId")
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Workflow execution API working!")
                print(f"   Execution ID: {data.get('executionId')}")
                print(f"   Status: {data.get('status')}")
                print()
                
                # Wait a bit and check status
                await asyncio.sleep(2)
                
                exec_id = data.get('executionId')
                status_response = await client.get(f"{BASE_URL}/api/executions/{exec_id}")
                status_data = status_response.json()
                
                print(f"   Execution status after 2s: {status_data.get('status')}")
                print(f"   Progress: {status_data.get('progress', {})}")
                print()
                
                return True
            else:
                print(f"⚠️  API returned status {response.status_code}")
                print(f"   Response: {response.text}")
                print()
                return False
                
    except Exception as e:
        print(f"❌ Workflow execution test failed: {e}")
        print()
        return False


async def test_node_handlers():
    """Test 4: Node handlers are loaded"""
    print("=" * 60)
    print("Test 4: Node Handlers")
    print("=" * 60)
    
    try:
        from tasks.node_handlers import NODE_HANDLERS
        
        print(f"✅ {len(NODE_HANDLERS)} node handlers loaded:")
        for node_type in sorted(NODE_HANDLERS.keys()):
            print(f"   - {node_type}")
        print()
        return True
        
    except Exception as e:
        print(f"❌ Failed to load node handlers: {e}")
        print()
        return False


async def run_all_tests():
    """Run all tests"""
    print("")
    print("🔬 Prefect Service Test Suite")
    print("=" * 60)
    print(f"Timestamp: {datetime.now().isoformat()}")
    print(f"Target URL: {BASE_URL}")
    print()
    
    results = []
    
    # Test 1: Health check
    results.append(await test_health_check())
    
    # Test 2: Database connection
    results.append(await test_database_connection())
    
    # Test 3: Node handlers
    results.append(await test_node_handlers())
    
    # Test 4: Mock workflow execution
    results.append(await test_mock_workflow_execution())
    
    # Summary
    print("=" * 60)
    print("Test Summary")
    print("=" * 60)
    passed = sum(results)
    total = len(results)
    
    print(f"Passed: {passed}/{total}")
    print()
    
    if passed == total:
        print("✅ All tests passed!")
        print("🚀 Service is ready to use!")
    else:
        print("⚠️  Some tests failed")
        print("   Check the output above for details")
    
    print()


if __name__ == "__main__":
    print("")
    print("⚠️  Make sure the Prefect service is running before running tests!")
    print("   Run: python start_service.py")
    print("")
    input("Press Enter to continue...")
    print("")
    
    asyncio.run(run_all_tests())

