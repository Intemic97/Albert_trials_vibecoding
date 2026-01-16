#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script para ver las ejecuciones de workflows en formato legible
"""
import sqlite3
import json
import sys
from datetime import datetime
from pathlib import Path

# Fix encoding for Windows console
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

DB_PATH = Path(__file__).parent.parent / "database.sqlite"

def view_executions(limit=10):
    """Ver las últimas ejecuciones"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("=" * 80)
    print("📊 EJECUCIONES DE WORKFLOWS (últimas {})".format(limit))
    print("=" * 80)
    print()
    
    # Obtener ejecuciones
    cursor.execute("""
        SELECT 
            e.id,
            e.workflowId,
            w.name as workflowName,
            e.status,
            e.createdAt,
            e.startedAt,
            e.completedAt,
            e.currentNodeId,
            e.error
        FROM workflow_executions e
        LEFT JOIN workflows w ON e.workflowId = w.id
        ORDER BY e.createdAt DESC
        LIMIT ?
    """, (limit,))
    
    executions = cursor.fetchall()
    
    if not executions:
        print("❌ No hay ejecuciones registradas")
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
        print(f"   Workflow: {exec['workflowName'] or exec['workflowId']}")
        print(f"   Creado: {exec['createdAt']}")
        
        if exec['startedAt']:
            print(f"   Iniciado: {exec['startedAt']}")
        if exec['completedAt']:
            print(f"   Completado: {exec['completedAt']}")
        if exec['currentNodeId']:
            print(f"   Nodo actual: {exec['currentNodeId']}")
        if exec['error']:
            print(f"   ⚠️  Error: {exec['error'][:100]}")
        
        # Contar logs de esta ejecución
        cursor.execute("""
            SELECT COUNT(*) as total,
                   SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                   SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed
            FROM execution_logs
            WHERE executionId = ?
        """, (exec['id'],))
        
        log_stats = cursor.fetchone()
        if log_stats['total'] > 0:
            print(f"   📝 Nodos: {log_stats['completed']}/{log_stats['total']} completados, {log_stats['failed']} fallidos")
        
        print()
    
    conn.close()

def view_execution_logs(execution_id):
    """Ver logs detallados de una ejecución"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    # Verificar que existe la ejecución
    cursor.execute("SELECT * FROM workflow_executions WHERE id = ?", (execution_id,))
    execution = cursor.fetchone()
    
    if not execution:
        print(f"❌ Ejecución '{execution_id}' no encontrada")
        return
    
    print("=" * 80)
    print(f"📝 LOGS DE EJECUCIÓN: {execution_id}")
    print("=" * 80)
    print(f"Status: {execution['status']}")
    print(f"Workflow ID: {execution['workflowId']}")
    print()
    
    # Obtener logs
    cursor.execute("""
        SELECT nodeId, nodeType, status, duration, timestamp, outputData, error
        FROM execution_logs
        WHERE executionId = ?
        ORDER BY timestamp ASC
    """, (execution_id,))
    
    logs = cursor.fetchall()
    
    if not logs:
        print("❌ No hay logs para esta ejecución")
        return
    
    for i, log in enumerate(logs, 1):
        status_emoji = {
            'running': '🔄',
            'completed': '✅',
            'error': '❌',
            'skipped': '⏭️'
        }.get(log['status'], '❓')
        
        duration_str = f"{log['duration']}ms" if log['duration'] else "N/A"
        
        print(f"{i}. {status_emoji} {log['nodeId']} ({log['nodeType']})")
        print(f"   Status: {log['status']} | Duración: {duration_str}")
        print(f"   Timestamp: {log['timestamp']}")
        
        if log['error']:
            print(f"   ⚠️  Error: {log['error'][:200]}")
        
        if log['outputData'] and log['status'] == 'completed':
            try:
                output = json.loads(log['outputData'])
                if isinstance(output, dict) and 'message' in output:
                    print(f"   💬 {output['message'][:100]}")
            except:
                pass
        
        print()
    
    conn.close()

def view_active_executions():
    """Ver solo las ejecuciones activas (pending/running)"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    print("=" * 80)
    print("🔄 EJECUCIONES ACTIVAS (pending/running)")
    print("=" * 80)
    print()
    
    cursor.execute("""
        SELECT 
            e.id,
            e.workflowId,
            w.name as workflowName,
            e.status,
            e.createdAt,
            e.currentNodeId
        FROM workflow_executions e
        LEFT JOIN workflows w ON e.workflowId = w.id
        WHERE e.status IN ('pending', 'running')
        ORDER BY e.createdAt DESC
    """)
    
    executions = cursor.fetchall()
    
    if not executions:
        print("✅ No hay ejecuciones activas en este momento")
        return
    
    for exec in executions:
        print(f"🔄 {exec['status'].upper()}: {exec['id']}")
        print(f"   Workflow: {exec['workflowName'] or exec['workflowId']}")
        print(f"   Creado: {exec['createdAt']}")
        if exec['currentNodeId']:
            print(f"   Nodo actual: {exec['currentNodeId']}")
        print()
    
    conn.close()

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "logs" and len(sys.argv) > 2:
            # python view_executions.py logs <execution_id>
            view_execution_logs(sys.argv[2])
        elif sys.argv[1] == "active":
            # python view_executions.py active
            view_active_executions()
        else:
            # python view_executions.py <limit>
            try:
                limit = int(sys.argv[1])
                view_executions(limit)
            except ValueError:
                print("Uso: python view_executions.py [limit|logs <id>|active]")
    else:
        view_executions()

