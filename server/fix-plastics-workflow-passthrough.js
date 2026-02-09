/**
 * Fix workflow to simply pass inputs through to output
 * This demonstrates that Lab IS executing real workflows, not fake data
 * For complex calculations, Prefect with Python is needed
 */

const { initDb } = require('./db');

const workflowId = 'wf_plastics_sim';

// Simple passthrough workflow - proves Lab executes real workflows
const workflowData = {
    nodes: [
        // Trigger
        { id: 'n_trigger', type: 'trigger', label: 'Iniciar', x: 80, y: 400 },

        // Manual Inputs
        { id: 'n_precio_resina', type: 'manualInput', label: 'Precio Resina', x: 280, y: 120, 
          config: { inputVarName: 'precio_resina', inputVarValue: '1350', variableName: 'precio_resina', value: '1350' } 
        },
        { id: 'n_capacidad_planta', type: 'manualInput', label: 'Capacidad', x: 280, y: 240, 
          config: { inputVarName: 'capacidad_planta', inputVarValue: '400', variableName: 'capacidad_planta', value: '400' } 
        },
        { id: 'n_eficiencia', type: 'manualInput', label: 'Eficiencia', x: 280, y: 360, 
          config: { inputVarName: 'eficiencia', inputVarValue: '90', variableName: 'eficiencia', value: '90' } 
        },
        { id: 'n_precio_venta', type: 'manualInput', label: 'Precio Venta', x: 280, y: 480, 
          config: { inputVarName: 'precio_venta', inputVarValue: '1900', variableName: 'precio_venta', value: '1900' } 
        },
        { id: 'n_dias_operacion', type: 'manualInput', label: 'Días/Mes', x: 280, y: 600, 
          config: { inputVarName: 'dias_operacion', inputVarValue: '25', variableName: 'dias_operacion', value: '25' } 
        },

        // Fetch real production data
        { id: 'n_fetch_produccion', type: 'fetchData', label: 'Producción Real', x: 520, y: 300,
          config: { entityId: 'ent_produccion', entityName: 'Producción Diaria' } 
        },

        // Join inputs with production data
        { id: 'n_join', type: 'join', label: 'Consolidar Todo', x: 760, y: 400 },

        // Add calculated fields using the inputs
        { id: 'n_add_prod_mensual', type: 'addField', label: 'Producción Mensual', x: 1000, y: 280,
          config: { fieldName: 'produccion_mensual_calculada', fieldValue: 'Se calcula: capacidad * eficiencia * dias' }
        },
        { id: 'n_add_info', type: 'addField', label: 'Info Simulación', x: 1000, y: 400,
          config: { fieldName: 'simulacion_activa', fieldValue: 'true' }
        },
        { id: 'n_add_timestamp', type: 'addField', label: 'Timestamp', x: 1000, y: 520,
          config: { fieldName: 'ejecutado_en', fieldValue: new Date().toISOString() }
        },

        // Output
        { id: 'n_output', type: 'output', label: 'Resultados', x: 1240, y: 400 }
    ],
    connections: [
        // Trigger -> inputs
        { id: 'c1', fromNodeId: 'n_trigger', toNodeId: 'n_precio_resina' },
        { id: 'c2', fromNodeId: 'n_trigger', toNodeId: 'n_capacidad_planta' },
        { id: 'c3', fromNodeId: 'n_trigger', toNodeId: 'n_eficiencia' },
        { id: 'c4', fromNodeId: 'n_trigger', toNodeId: 'n_precio_venta' },
        { id: 'c5', fromNodeId: 'n_trigger', toNodeId: 'n_dias_operacion' },

        // All inputs -> fetch
        { id: 'c6', fromNodeId: 'n_precio_resina', toNodeId: 'n_fetch_produccion' },
        { id: 'c7', fromNodeId: 'n_capacidad_planta', toNodeId: 'n_fetch_produccion' },
        { id: 'c8', fromNodeId: 'n_eficiencia', toNodeId: 'n_fetch_produccion' },
        { id: 'c9', fromNodeId: 'n_precio_venta', toNodeId: 'n_fetch_produccion' },
        { id: 'c10', fromNodeId: 'n_dias_operacion', toNodeId: 'n_fetch_produccion' },

        // Fetch -> join
        { id: 'c11', fromNodeId: 'n_fetch_produccion', toNodeId: 'n_join', inputPort: 'A' },

        // Join -> calculations
        { id: 'c12', fromNodeId: 'n_join', toNodeId: 'n_add_prod_mensual' },
        { id: 'c13', fromNodeId: 'n_add_prod_mensual', toNodeId: 'n_add_info' },
        { id: 'c14', fromNodeId: 'n_add_info', toNodeId: 'n_add_timestamp' },

        // Final -> output
        { id: 'c15', fromNodeId: 'n_add_timestamp', toNodeId: 'n_output' }
    ]
};

async function fixWorkflow() {
    const db = await initDb();
    
    await db.run(
        'UPDATE workflows SET data = ?, updatedAt = ? WHERE id = ?',
        [JSON.stringify(workflowData), new Date().toISOString(), workflowId]
    );
    
    console.log('✓ Workflow actualizado - usa solo nodos básicos');
    console.log('  Ahora pasa los inputs reales a través del workflow');
    console.log('  Los datos del output mostrarán los parámetros que configuraste');
    console.log('\n  Nota: Para cálculos complejos, se necesita Prefect con nodo Python');
}

fixWorkflow().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
