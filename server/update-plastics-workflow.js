/**
 * Update workflow to use basic nodes instead of Python
 * (Python only works with Prefect, and local executor doesn't support it)
 */

const { initDb } = require('./db');

const workflowId = 'wf_plastics_sim';

// Simplified workflow using only basic nodes
const workflowData = {
    nodes: [
        // Trigger
        { id: 'n_trigger', type: 'trigger', label: 'Iniciar Simulación', x: 80, y: 350 },

        // Manual Inputs (parámetros del Lab)
        { 
            id: 'n_precio_resina', 
            type: 'manualInput', 
            label: 'Precio Resina (USD/ton)', 
            x: 300, y: 100, 
            config: { 
                inputVarName: 'precio_resina', 
                inputVarValue: '1350',
                variableName: 'precio_resina',
                value: '1350'
            } 
        },
        { 
            id: 'n_capacidad_planta', 
            type: 'manualInput', 
            label: 'Capacidad Planta (ton/día)', 
            x: 300, y: 220, 
            config: { 
                inputVarName: 'capacidad_planta', 
                inputVarValue: '400',
                variableName: 'capacidad_planta',
                value: '400'
            } 
        },
        { 
            id: 'n_eficiencia', 
            type: 'manualInput', 
            label: 'Eficiencia (%)', 
            x: 300, y: 340, 
            config: { 
                inputVarName: 'eficiencia', 
                inputVarValue: '90',
                variableName: 'eficiencia',
                value: '90'
            } 
        },
        { 
            id: 'n_precio_venta', 
            type: 'manualInput', 
            label: 'Precio Venta (USD/ton)', 
            x: 300, y: 460, 
            config: { 
                inputVarName: 'precio_venta', 
                inputVarValue: '1900',
                variableName: 'precio_venta',
                value: '1900'
            } 
        },
        { 
            id: 'n_dias_operacion', 
            type: 'manualInput', 
            label: 'Días/Mes', 
            x: 300, y: 580, 
            config: { 
                inputVarName: 'dias_operacion', 
                inputVarValue: '25',
                variableName: 'dias_operacion',
                value: '25'
            } 
        },

        // Fetch real data
        { 
            id: 'n_fetch_produccion', 
            type: 'fetchData', 
            label: 'Datos Producción Real', 
            x: 560, y: 250, 
            config: { 
                entityId: 'ent_produccion', 
                entityName: 'Producción Diaria' 
            } 
        },

        // LLM node to do calculations
        { 
            id: 'n_calculo_llm', 
            type: 'llm', 
            label: 'Calcular P&L', 
            x: 820, y: 350, 
            config: {
                systemPrompt: `Eres un analista financiero especializado en plantas petroquímicas de producción de plástico.

Te voy a dar:
1. Parámetros de operación (precio_resina, capacidad_planta, eficiencia, precio_venta, dias_operacion)
2. Datos reales de producción de los últimos días

Debes calcular y devolver EXACTAMENTE este JSON (sin markdown, solo JSON puro):

{
  "produccion_mensual": [número],
  "ingresos": [número],
  "costo_total": [número],
  "beneficio": [número],
  "margen": [número con 1 decimal],
  "costo_por_ton": [número],
  "proyeccion_mensual": [
    {"name": "Mes 1", "produccion": [número], "ingresos": [número], "costos": [número], "beneficio": [número]},
    ...12 meses
  ],
  "desglose_costos": [
    {"name": "Resina/Feedstock", "value": [número]},
    {"name": "Energía", "value": [número]},
    {"name": "Mano de Obra", "value": [número]},
    {"name": "Mantenimiento", "value": [número]}
  ],
  "ingresos_anuales": [número],
  "beneficio_anual": [número]
}

Fórmulas:
- produccion_mensual = capacidad_planta * (eficiencia/100) * dias_operacion
- costo_resina = produccion_mensual * precio_resina
- costo_energia = produccion_mensual * 45
- costo_mano_obra = 180000 (fijo)
- costo_mantenimiento = produccion_mensual * 12
- costo_total = suma de costos
- ingresos = produccion_mensual * precio_venta
- beneficio = ingresos - costo_total
- margen = (beneficio/ingresos)*100

Para proyección 12 meses, aplica factor estacional: +5% en meses 3,4,5,9,10,11 y -2% en el resto.

Devuelve SOLO el JSON, sin explicaciones.`,
                userPrompt: `Calcula P&L con estos parámetros:
- Precio resina: {{precio_resina}} USD/ton
- Capacidad: {{capacidad_planta}} ton/día  
- Eficiencia: {{eficiencia}}%
- Precio venta: {{precio_venta}} USD/ton
- Días operación: {{dias_operacion}} días/mes

Datos producción real: {{_data}}

Devuelve el JSON de resultados.`,
                responseFormat: 'json'
            } 
        },

        // Output
        { 
            id: 'n_output', 
            type: 'output', 
            label: 'Resultados', 
            x: 1080, y: 350 
        }
    ],
    connections: [
        // Trigger -> inputs
        { id: 'c1', fromNodeId: 'n_trigger', toNodeId: 'n_precio_resina' },
        { id: 'c2', fromNodeId: 'n_trigger', toNodeId: 'n_capacidad_planta' },
        { id: 'c3', fromNodeId: 'n_trigger', toNodeId: 'n_eficiencia' },
        { id: 'c4', fromNodeId: 'n_trigger', toNodeId: 'n_precio_venta' },
        { id: 'c5', fromNodeId: 'n_trigger', toNodeId: 'n_dias_operacion' },

        // Inputs -> fetch
        { id: 'c6', fromNodeId: 'n_precio_resina', toNodeId: 'n_fetch_produccion' },
        { id: 'c7', fromNodeId: 'n_capacidad_planta', toNodeId: 'n_fetch_produccion' },
        { id: 'c8', fromNodeId: 'n_eficiencia', toNodeId: 'n_fetch_produccion' },
        { id: 'c9', fromNodeId: 'n_precio_venta', toNodeId: 'n_fetch_produccion' },
        { id: 'c10', fromNodeId: 'n_dias_operacion', toNodeId: 'n_fetch_produccion' },

        // Fetch -> LLM
        { id: 'c11', fromNodeId: 'n_fetch_produccion', toNodeId: 'n_calculo_llm' },

        // LLM -> output
        { id: 'c12', fromNodeId: 'n_calculo_llm', toNodeId: 'n_output' }
    ]
};

async function updateWorkflow() {
    const db = await initDb();
    
    await db.run(
        'UPDATE workflows SET data = ?, updatedAt = ? WHERE id = ?',
        [JSON.stringify(workflowData), new Date().toISOString(), workflowId]
    );
    
    console.log('✓ Workflow actualizado a usar nodo LLM en vez de Python');
    console.log('  El nodo LLM funciona con el executor local y calcula el P&L');
}

updateWorkflow().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
