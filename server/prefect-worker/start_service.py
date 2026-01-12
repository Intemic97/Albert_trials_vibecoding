"""
Start the Workflow Orchestration Service

This script starts the FastAPI service that receives workflow execution requests
"""
import uvicorn
import config

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Workflow Orchestration Service with Prefect")
    print("=" * 60)
    print("")
    print("📍 Service Configuration:")
    print(f"   - API URL: http://{config.API_HOST}:{config.API_PORT}")
    print(f"   - Database: {config.DATABASE_PATH}")
    print(f"   - Prefect API: {config.PREFECT_API_URL}")
    print("")
    print("🎯 Features:")
    print("   ✅ Background workflow execution")
    print("   ✅ User can close browser - workflows continue")
    print("   ✅ Real-time status updates via polling/WebSocket")
    print("   ✅ Scalable & resilient architecture")
    print("")
    print("📊 Endpoints:")
    print(f"   - POST   http://{config.API_HOST}:{config.API_PORT}/api/workflows/execute")
    print(f"   - GET    http://{config.API_HOST}:{config.API_PORT}/api/executions/{{id}}")
    print(f"   - GET    http://{config.API_HOST}:{config.API_PORT}/api/executions/{{id}}/logs")
    print("")
    print("🔥 Starting service...")
    print("")
    
    uvicorn.run(
        "api_service:app",
        host=config.API_HOST,
        port=config.API_PORT,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )

