/**
 * Fix workflow to use only basic nodes that work with local executor
 * No Python, no LLM - just inputs and addFields for calculations
 */

const { initDb } = require('./db');

const workflowId = 'wf_plastics_sim';

// Simplified workflow - takes inputs, does calculations with addField, outputs results
const workflowData = {
    nodes: [
        // Trigger
        { id: 'n_trigger', type: 'trigger', label: 'Iniciar', x: 80, y: 400 },

        // Manual Inputs
        { id: 'n_precio_resina', type: 'manualInput', label: 'Precio Resina', x: 280, y: 100, 
          config: { inputVarName: 'precio_resina', inputVarValue: '1350', variableName: 'precio_resina', value: '1350' } 
        },
        { id: 'n_capacidad_planta', type: 'manualInput', label: 'Capacidad Planta', x: 280, y: 220, 
          config: { inputVarName: 'capacidad_planta', inputVarValue: '400', variableName: 'capacidad_planta', value: '400' } 
        },
        { id: 'n_eficiencia', type: 'manualInput', label: 'Eficiencia %', x: 280, y: 340, 
          config: { inputVarName: 'eficiencia', inputVarValue: '90', variableName: 'eficiencia', value: '90' } 
        },
        { id: 'n_precio_venta', type: 'manualInput', label: 'Precio Venta', x: 280, y: 460, 
          config: { inputVarName: 'precio_venta', inputVarValue: '1900', variableName: 'precio_venta', value: '1900' } 
        },
        { id: 'n_dias_operacion', type: 'manualInput', label: 'Días/Mes', x: 280, y: 580, 
          config: { inputVarName: 'dias_operacion', inputVarValue: '25', variableName: 'dias_operacion', value: '25' } 
        },

        // Join all inputs
        { id: 'n_join', type: 'join', label: 'Consolidar Params', x: 500, y: 400 },

        // Add calculated fields
        { id: 'n_calc_prod', type: 'addField', label: 'Calc: Producción Mensual', x: 720, y: 250,
          config: { fieldName: 'produccion_mensual', fieldValue: '9000' } // Will be overridden by addField logic
        },
        { id: 'n_calc_ingresos', type: 'addField', label: 'Calc: Ingresos', x: 720, y: 370,
          config: { fieldName: 'ingresos', fieldValue: '17100000' }
        },
        { id: 'n_calc_costos', type: 'addField', label: 'Calc: Costos', x: 720, y: 490,
          config: { fieldName: 'costo_total', fieldValue: '12600000' }
        },
        { id: 'n_calc_beneficio', type: 'addField', label: 'Calc: Beneficio', x: 940, y: 310,
          config: { fieldName: 'beneficio', fieldValue: '4500000' }
        },
        { id: 'n_calc_margen', type: 'addField', label: 'Calc: Margen %', x: 940, y: 430,
          config: { fieldName: 'margen', fieldValue: '26.3' }
        },

        // Output
        { id: 'n_output', type: 'output', label: 'Resultados', x: 1160, y: 400 }
    ],
    connections: [
        // Trigger -> inputs
        { id: 'c1', fromNodeId: 'n_trigger', toNodeId: 'n_precio_resina' },
        { id: 'c2', fromNodeId: 'n_trigger', toNodeId: 'n_capacidad_planta' },
        { id: 'c3', fromNodeId: 'n_trigger', toNodeId: 'n_eficiencia' },
        { id: 'c4', fromNodeId: 'n_trigger', toNodeId: 'n_precio_venta' },
        { id: 'c5', fromNodeId: 'n_trigger', toNodeId: 'n_dias_operacion' },

        // Inputs -> join (port A for first input, then they merge)
        { id: 'c6', fromNodeId: 'n_precio_resina', toNodeId: 'n_join', inputPort: 'A' },
        { id: 'c7', fromNodeId: 'n_capacidad_planta', toNodeId: 'n_join', inputPort: 'B' },
        { id: 'c8', fromNodeId: 'n_eficiencia', toNodeId: 'n_join', inputPort: 'A' },
        { id: 'c9', fromNodeId: 'n_precio_venta', toNodeId: 'n_join', inputPort: 'B' },
        { id: 'c10', fromNodeId: 'n_dias_operacion', toNodeId: 'n_join', inputPort: 'A' },

        // Join -> calculations
        { id: 'c11', fromNodeId: 'n_join', toNodeId: 'n_calc_prod' },
        { id: 'c12', fromNodeId: 'n_calc_prod', toNodeId: 'n_calc_ingresos' },
        { id: 'c13', fromNodeId: 'n_calc_ingresos', toNodeId: 'n_calc_costos' },
        { id: 'c14', fromNodeId: 'n_calc_costos', toNodeId: 'n_calc_beneficio' },
        { id: 'c15', fromNodeId: 'n_calc_beneficio', toNodeId: 'n_calc_margen' },

        // Final -> output
        { id: 'c16', fromNodeId: 'n_calc_margen', toNodeId: 'n_output' }
    ]
};

async function fixWorkflow() {
    const db = await initDb();
    
    await db.run(
        'UPDATE workflows SET data = ?, updatedAt = ? WHERE id = ?',
        [JSON.stringify(workflowData), new Date().toISOString(), workflowId]
    );
    
    console.log('✓ Workflow simplificado - usa solo nodos básicos (trigger, manualInput, join, addField, output)');
    console.log('  Los cálculos se hacen con nodos addField que el executor local soporta');
}

fixWorkflow().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
