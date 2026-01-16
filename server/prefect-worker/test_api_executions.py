#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script de prueba para consultar las ejecuciones a través de la API
"""
import sys
import requests
import json
from datetime import datetime

# Fix encoding for Windows console
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

API_URL = "http://localhost:8000"

def test_health():
    """Verificar que el servicio esté corriendo"""
    try:
        response = requests.get(f"{API_URL}/")
        if response.status_code == 200:
            data = response.json()
            print("✅ Servicio corriendo")
            print(f"   Version: {data.get('version')}")
            print(f"   Timestamp: {data.get('timestamp')}")
            return True
        else:
            print("❌ Servicio no responde correctamente")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ No se puede conectar al servicio. ¿Está corriendo en puerto 8000?")
        return False

def get_execution_status(execution_id):
    """Obtener el estado de una ejecución"""
    print(f"\n📊 Estado de ejecución: {execution_id}")
    print("=" * 60)
    
    try:
        response = requests.get(f"{API_URL}/api/executions/{execution_id}")
        
        if response.status_code == 404:
            print("❌ Ejecución no encontrada")
            return
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return
        
        data = response.json()
        
        status_emoji = {
            'pending': '⏳',
            'running': '🔄',
            'completed': '✅',
            'failed': '❌'
        }.get(data['status'], '❓')
        
        print(f"Status: {status_emoji} {data['status'].upper()}")
        print(f"Workflow ID: {data['workflowId']}")
        print(f"Creado: {data['createdAt']}")
        
        if data.get('startedAt'):
            print(f"Iniciado: {data['startedAt']}")
        if data.get('completedAt'):
            print(f"Completado: {data['completedAt']}")
        if data.get('currentNodeId'):
            print(f"Nodo actual: {data['currentNodeId']}")
        if data.get('error'):
            print(f"⚠️  Error: {data['error']}")
        
        if data.get('progress'):
            prog = data['progress']
            print(f"\n📈 Progreso:")
            print(f"   Total nodos: {prog['totalNodes']}")
            print(f"   Completados: {prog['completedNodes']}")
            print(f"   Fallidos: {prog['failedNodes']}")
            print(f"   Porcentaje: {prog['percentage']}%")
        
        if data.get('logs'):
            print(f"\n📝 Últimos logs ({len(data['logs'])}):")
            for log in data['logs'][-5:]:  # Últimos 5
                status_emoji = {
                    'running': '🔄',
                    'completed': '✅',
                    'error': '❌'
                }.get(log['status'], '❓')
                print(f"   {status_emoji} {log['nodeId']} ({log['nodeType']}) - {log['status']}")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def get_execution_logs(execution_id):
    """Obtener todos los logs de una ejecución"""
    print(f"\n📝 Logs detallados: {execution_id}")
    print("=" * 60)
    
    try:
        response = requests.get(f"{API_URL}/api/executions/{execution_id}/logs")
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            return
        
        data = response.json()
        logs = data.get('logs', [])
        
        if not logs:
            print("No hay logs disponibles")
            return
        
        for i, log in enumerate(logs, 1):
            status_emoji = {
                'running': '🔄',
                'completed': '✅',
                'error': '❌',
                'skipped': '⏭️'
            }.get(log['status'], '❓')
            
            duration = f"{log['duration']}ms" if log.get('duration') else "N/A"
            
            print(f"\n{i}. {status_emoji} {log['nodeId']} ({log['nodeType']})")
            print(f"   Status: {log['status']} | Duración: {duration}")
            print(f"   Timestamp: {log['timestamp']}")
            
            if log.get('error'):
                print(f"   ⚠️  Error: {log['error'][:200]}")
            
            if log.get('outputData'):
                try:
                    output = json.loads(log['outputData'])
                    if isinstance(output, dict):
                        if 'message' in output:
                            print(f"   💬 {output['message'][:100]}")
                        elif 'outputData' in output:
                            print(f"   📤 Datos de salida disponibles")
                except:
                    pass
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def get_workflow_executions(workflow_id, limit=10):
    """Obtener todas las ejecuciones de un workflow"""
    print(f"\n📊 Ejecuciones del workflow: {workflow_id}")
    print("=" * 60)
    
    try:
        response = requests.get(f"{API_URL}/api/workflows/{workflow_id}/executions?limit={limit}")
        
        if response.status_code == 404:
            print("❌ Workflow no encontrado")
            return
        
        if response.status_code != 200:
            print(f"❌ Error: {response.status_code}")
            return
        
        data = response.json()
        executions = data.get('executions', [])
        
        print(f"Workflow: {data.get('workflowName')}")
        print(f"Total ejecuciones: {data.get('total')}")
        print()
        
        if not executions:
            print("No hay ejecuciones registradas")
            return
        
        for i, exec in enumerate(executions, 1):
            status_emoji = {
                'pending': '⏳',
                'running': '🔄',
                'completed': '✅',
                'failed': '❌'
            }.get(exec['status'], '❓')
            
            print(f"{i}. {status_emoji} {exec['status'].upper()}")
            print(f"   ID: {exec['id']}")
            print(f"   Creado: {exec['createdAt']}")
            if exec.get('completedAt'):
                print(f"   Completado: {exec['completedAt']}")
            if exec.get('error'):
                print(f"   ⚠️  Error: {exec['error'][:100]}")
            print()
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def interactive_menu():
    """Menú interactivo"""
    if not test_health():
        return
    
    while True:
        print("\n" + "=" * 60)
        print("🔍 MONITOR DE EJECUCIONES - API")
        print("=" * 60)
        print("1. Ver estado de una ejecución")
        print("2. Ver logs detallados de una ejecución")
        print("3. Ver ejecuciones de un workflow")
        print("4. Salir")
        print()
        
        choice = input("Selecciona una opción (1-4): ").strip()
        
        if choice == "1":
            exec_id = input("ID de ejecución: ").strip()
            if exec_id:
                get_execution_status(exec_id)
        
        elif choice == "2":
            exec_id = input("ID de ejecución: ").strip()
            if exec_id:
                get_execution_logs(exec_id)
        
        elif choice == "3":
            workflow_id = input("ID de workflow: ").strip()
            if workflow_id:
                limit = input("Límite (default 10): ").strip()
                limit = int(limit) if limit else 10
                get_workflow_executions(workflow_id, limit)
        
        elif choice == "4":
            print("👋 ¡Hasta luego!")
            break
        
        else:
            print("❌ Opción inválida")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "status" and len(sys.argv) > 2:
            test_health()
            get_execution_status(sys.argv[2])
        
        elif command == "logs" and len(sys.argv) > 2:
            test_health()
            get_execution_logs(sys.argv[2])
        
        elif command == "workflow" and len(sys.argv) > 2:
            test_health()
            limit = int(sys.argv[3]) if len(sys.argv) > 3 else 10
            get_workflow_executions(sys.argv[2], limit)
        
        else:
            print("Uso:")
            print("  python test_api_executions.py                    # Menú interactivo")
            print("  python test_api_executions.py status <exec_id>   # Ver estado")
            print("  python test_api_executions.py logs <exec_id>     # Ver logs")
            print("  python test_api_executions.py workflow <wf_id>   # Ver ejecuciones")
    else:
        interactive_menu()

