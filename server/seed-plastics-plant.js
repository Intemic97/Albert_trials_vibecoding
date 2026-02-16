/**
 * Seed: Planta de Producción de Plástico - Oil & Gas
 * 
 * Crea entidades, registros con datos realistas, un workflow de simulación
 * de producción, y un experimento en Lab listo para usar.
 * 
 * Uso: node server/seed-plastics-plant.js
 */

const { initDb, openDb } = require('./db');

// Auto-detect org: will be set dynamically in seed function
let ORG_ID = null;

// ============================================================================
// ENTIDADES
// ============================================================================

const entities = [
    {
        id: 'ent_extrusoras',
        name: 'Extrusoras',
        description: 'Líneas de extrusión de polietileno y polipropileno de la planta.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_ext_nombre', name: 'Nombre Línea', type: 'text', defaultValue: '' },
            { id: 'p_ext_tipo', name: 'Tipo Polímero', type: 'text', defaultValue: 'HDPE' },
            { id: 'p_ext_capacidad', name: 'Capacidad (ton/h)', type: 'number', defaultValue: '0' },
            { id: 'p_ext_temp_operacion', name: 'Temp Operación (°C)', type: 'number', defaultValue: '0' },
            { id: 'p_ext_presion', name: 'Presión (bar)', type: 'number', defaultValue: '0' },
            { id: 'p_ext_estado', name: 'Estado', type: 'text', defaultValue: 'Operativa' },
            { id: 'p_ext_eficiencia', name: 'Eficiencia (%)', type: 'number', defaultValue: '0' },
            { id: 'p_ext_horas_op', name: 'Horas Operación', type: 'number', defaultValue: '0' }
        ]
    },
    {
        id: 'ent_materia_prima',
        name: 'Materia Prima',
        description: 'Inventario de resinas, aditivos y materias primas derivadas del petróleo.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_mp_nombre', name: 'Material', type: 'text', defaultValue: '' },
            { id: 'p_mp_tipo', name: 'Tipo', type: 'text', defaultValue: 'Resina' },
            { id: 'p_mp_stock', name: 'Stock (ton)', type: 'number', defaultValue: '0' },
            { id: 'p_mp_precio', name: 'Precio (USD/ton)', type: 'number', defaultValue: '0' },
            { id: 'p_mp_proveedor', name: 'Proveedor', type: 'text', defaultValue: '' },
            { id: 'p_mp_lead_time', name: 'Lead Time (días)', type: 'number', defaultValue: '0' },
            { id: 'p_mp_punto_reorden', name: 'Punto Reorden (ton)', type: 'number', defaultValue: '0' }
        ]
    },
    {
        id: 'ent_produccion',
        name: 'Producción Diaria',
        description: 'Registro diario de producción de cada línea de extrusión.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_prod_fecha', name: 'Fecha', type: 'text', defaultValue: '' },
            { id: 'p_prod_linea', name: 'Línea', type: 'relation', relatedEntityId: 'ent_extrusoras' },
            { id: 'p_prod_producto', name: 'Producto', type: 'text', defaultValue: '' },
            { id: 'p_prod_toneladas', name: 'Producción (ton)', type: 'number', defaultValue: '0' },
            { id: 'p_prod_scrap', name: 'Scrap (%)', type: 'number', defaultValue: '0' },
            { id: 'p_prod_energia', name: 'Energía (kWh)', type: 'number', defaultValue: '0' },
            { id: 'p_prod_calidad', name: 'Calidad', type: 'text', defaultValue: 'A' },
            { id: 'p_prod_turno', name: 'Turno', type: 'text', defaultValue: 'Día' }
        ]
    },
    {
        id: 'ent_ordenes',
        name: 'Órdenes de Producción',
        description: 'Órdenes activas y planificadas de producción de plástico.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_ord_codigo', name: 'Código Orden', type: 'text', defaultValue: '' },
            { id: 'p_ord_cliente', name: 'Cliente', type: 'text', defaultValue: '' },
            { id: 'p_ord_producto', name: 'Producto', type: 'text', defaultValue: '' },
            { id: 'p_ord_cantidad', name: 'Cantidad (ton)', type: 'number', defaultValue: '0' },
            { id: 'p_ord_fecha_entrega', name: 'Fecha Entrega', type: 'text', defaultValue: '' },
            { id: 'p_ord_estado', name: 'Estado', type: 'text', defaultValue: 'Pendiente' },
            { id: 'p_ord_precio_ton', name: 'Precio (USD/ton)', type: 'number', defaultValue: '0' },
            { id: 'p_ord_prioridad', name: 'Prioridad', type: 'text', defaultValue: 'Normal' }
        ]
    }
];

// ============================================================================
// REGISTROS CON DATOS REALISTAS
// ============================================================================

const records = [
    // --- Extrusoras ---
    {
        id: 'r_ext_1', entityId: 'ent_extrusoras',
        values: { 'p_ext_nombre': 'EXT-001 HDPE Film', 'p_ext_tipo': 'HDPE', 'p_ext_capacidad': '4.5', 'p_ext_temp_operacion': '220', 'p_ext_presion': '180', 'p_ext_estado': 'Operativa', 'p_ext_eficiencia': '92', 'p_ext_horas_op': '18500' }
    },
    {
        id: 'r_ext_2', entityId: 'ent_extrusoras',
        values: { 'p_ext_nombre': 'EXT-002 PP Sheet', 'p_ext_tipo': 'PP', 'p_ext_capacidad': '3.8', 'p_ext_temp_operacion': '245', 'p_ext_presion': '200', 'p_ext_estado': 'Operativa', 'p_ext_eficiencia': '88', 'p_ext_horas_op': '15200' }
    },
    {
        id: 'r_ext_3', entityId: 'ent_extrusoras',
        values: { 'p_ext_nombre': 'EXT-003 LDPE Tubería', 'p_ext_tipo': 'LDPE', 'p_ext_capacidad': '2.9', 'p_ext_temp_operacion': '195', 'p_ext_presion': '150', 'p_ext_estado': 'Mantenimiento', 'p_ext_eficiencia': '0', 'p_ext_horas_op': '22100' }
    },
    {
        id: 'r_ext_4', entityId: 'ent_extrusoras',
        values: { 'p_ext_nombre': 'EXT-004 HDPE Contenedores', 'p_ext_tipo': 'HDPE', 'p_ext_capacidad': '5.2', 'p_ext_temp_operacion': '230', 'p_ext_presion': '210', 'p_ext_estado': 'Operativa', 'p_ext_eficiencia': '95', 'p_ext_horas_op': '8300' }
    },
    {
        id: 'r_ext_5', entityId: 'ent_extrusoras',
        values: { 'p_ext_nombre': 'EXT-005 PP Fibra', 'p_ext_tipo': 'PP', 'p_ext_capacidad': '3.1', 'p_ext_temp_operacion': '260', 'p_ext_presion': '220', 'p_ext_estado': 'Operativa', 'p_ext_eficiencia': '85', 'p_ext_horas_op': '19800' }
    },

    // --- Materia Prima ---
    {
        id: 'r_mp_1', entityId: 'ent_materia_prima',
        values: { 'p_mp_nombre': 'Resina HDPE HF4760', 'p_mp_tipo': 'Resina', 'p_mp_stock': '450', 'p_mp_precio': '1350', 'p_mp_proveedor': 'SABIC', 'p_mp_lead_time': '14', 'p_mp_punto_reorden': '200' }
    },
    {
        id: 'r_mp_2', entityId: 'ent_materia_prima',
        values: { 'p_mp_nombre': 'Resina PP H030SG', 'p_mp_tipo': 'Resina', 'p_mp_stock': '320', 'p_mp_precio': '1180', 'p_mp_proveedor': 'LyondellBasell', 'p_mp_lead_time': '21', 'p_mp_punto_reorden': '150' }
    },
    {
        id: 'r_mp_3', entityId: 'ent_materia_prima',
        values: { 'p_mp_nombre': 'Resina LDPE FT5230', 'p_mp_tipo': 'Resina', 'p_mp_stock': '85', 'p_mp_precio': '1420', 'p_mp_proveedor': 'ExxonMobil Chemical', 'p_mp_lead_time': '18', 'p_mp_punto_reorden': '100' }
    },
    {
        id: 'r_mp_4', entityId: 'ent_materia_prima',
        values: { 'p_mp_nombre': 'Masterbatch Negro UV', 'p_mp_tipo': 'Aditivo', 'p_mp_stock': '28', 'p_mp_precio': '3200', 'p_mp_proveedor': 'Cabot Corp', 'p_mp_lead_time': '30', 'p_mp_punto_reorden': '15' }
    },
    {
        id: 'r_mp_5', entityId: 'ent_materia_prima',
        values: { 'p_mp_nombre': 'Estabilizador térmico Irganox', 'p_mp_tipo': 'Aditivo', 'p_mp_stock': '12', 'p_mp_precio': '8500', 'p_mp_proveedor': 'BASF', 'p_mp_lead_time': '45', 'p_mp_punto_reorden': '5' }
    },
    {
        id: 'r_mp_6', entityId: 'ent_materia_prima',
        values: { 'p_mp_nombre': 'Nafta craqueada (feedstock)', 'p_mp_tipo': 'Feedstock', 'p_mp_stock': '1200', 'p_mp_precio': '680', 'p_mp_proveedor': 'Repsol Química', 'p_mp_lead_time': '7', 'p_mp_punto_reorden': '500' }
    },

    // --- Producción Diaria (últimos 10 días) ---
    { id: 'r_prod_1', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-01', 'p_prod_linea': JSON.stringify(['r_ext_1']), 'p_prod_producto': 'Film HDPE 50μm', 'p_prod_toneladas': '98', 'p_prod_scrap': '2.1', 'p_prod_energia': '14200', 'p_prod_calidad': 'A', 'p_prod_turno': 'Día' } },
    { id: 'r_prod_2', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-01', 'p_prod_linea': JSON.stringify(['r_ext_2']), 'p_prod_producto': 'Lámina PP 2mm', 'p_prod_toneladas': '82', 'p_prod_scrap': '3.5', 'p_prod_energia': '12800', 'p_prod_calidad': 'A', 'p_prod_turno': 'Día' } },
    { id: 'r_prod_3', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-02', 'p_prod_linea': JSON.stringify(['r_ext_1']), 'p_prod_producto': 'Film HDPE 50μm', 'p_prod_toneladas': '101', 'p_prod_scrap': '1.8', 'p_prod_energia': '14500', 'p_prod_calidad': 'A', 'p_prod_turno': 'Día' } },
    { id: 'r_prod_4', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-02', 'p_prod_linea': JSON.stringify(['r_ext_4']), 'p_prod_producto': 'Contenedor HDPE 200L', 'p_prod_toneladas': '115', 'p_prod_scrap': '1.2', 'p_prod_energia': '16100', 'p_prod_calidad': 'A+', 'p_prod_turno': 'Noche' } },
    { id: 'r_prod_5', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-03', 'p_prod_linea': JSON.stringify(['r_ext_2']), 'p_prod_producto': 'Lámina PP 2mm', 'p_prod_toneladas': '78', 'p_prod_scrap': '4.1', 'p_prod_energia': '12200', 'p_prod_calidad': 'B', 'p_prod_turno': 'Día' } },
    { id: 'r_prod_6', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-03', 'p_prod_linea': JSON.stringify(['r_ext_5']), 'p_prod_producto': 'Fibra PP Industrial', 'p_prod_toneladas': '65', 'p_prod_scrap': '2.8', 'p_prod_energia': '9800', 'p_prod_calidad': 'A', 'p_prod_turno': 'Día' } },
    { id: 'r_prod_7', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-04', 'p_prod_linea': JSON.stringify(['r_ext_1']), 'p_prod_producto': 'Film HDPE 100μm', 'p_prod_toneladas': '92', 'p_prod_scrap': '2.5', 'p_prod_energia': '13800', 'p_prod_calidad': 'A', 'p_prod_turno': 'Día' } },
    { id: 'r_prod_8', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-04', 'p_prod_linea': JSON.stringify(['r_ext_4']), 'p_prod_producto': 'Contenedor HDPE 200L', 'p_prod_toneladas': '120', 'p_prod_scrap': '1.0', 'p_prod_energia': '16800', 'p_prod_calidad': 'A+', 'p_prod_turno': 'Noche' } },
    { id: 'r_prod_9', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-05', 'p_prod_linea': JSON.stringify(['r_ext_1']), 'p_prod_producto': 'Film HDPE 50μm', 'p_prod_toneladas': '105', 'p_prod_scrap': '1.5', 'p_prod_energia': '14900', 'p_prod_calidad': 'A+', 'p_prod_turno': 'Día' } },
    { id: 'r_prod_10', entityId: 'ent_produccion', values: { 'p_prod_fecha': '2026-02-05', 'p_prod_linea': JSON.stringify(['r_ext_2']), 'p_prod_producto': 'Lámina PP 4mm', 'p_prod_toneladas': '70', 'p_prod_scrap': '3.8', 'p_prod_energia': '11500', 'p_prod_calidad': 'A', 'p_prod_turno': 'Día' } },

    // --- Órdenes de Producción ---
    {
        id: 'r_ord_1', entityId: 'ent_ordenes',
        values: { 'p_ord_codigo': 'OP-2026-001', 'p_ord_cliente': 'Pemex Transformación', 'p_ord_producto': 'Film HDPE 50μm', 'p_ord_cantidad': '500', 'p_ord_fecha_entrega': '2026-02-28', 'p_ord_estado': 'En Producción', 'p_ord_precio_ton': '1850', 'p_ord_prioridad': 'Alta' }
    },
    {
        id: 'r_ord_2', entityId: 'ent_ordenes',
        values: { 'p_ord_codigo': 'OP-2026-002', 'p_ord_cliente': 'Repsol Downstream', 'p_ord_producto': 'Contenedor HDPE 200L', 'p_ord_cantidad': '800', 'p_ord_fecha_entrega': '2026-03-15', 'p_ord_estado': 'En Producción', 'p_ord_precio_ton': '2100', 'p_ord_prioridad': 'Normal' }
    },
    {
        id: 'r_ord_3', entityId: 'ent_ordenes',
        values: { 'p_ord_codigo': 'OP-2026-003', 'p_ord_cliente': 'Shell Chemicals', 'p_ord_producto': 'Lámina PP 2mm', 'p_ord_cantidad': '350', 'p_ord_fecha_entrega': '2026-02-20', 'p_ord_estado': 'Retrasada', 'p_ord_precio_ton': '1720', 'p_ord_prioridad': 'Alta' }
    },
    {
        id: 'r_ord_4', entityId: 'ent_ordenes',
        values: { 'p_ord_codigo': 'OP-2026-004', 'p_ord_cliente': 'TotalEnergies Polymers', 'p_ord_producto': 'Fibra PP Industrial', 'p_ord_cantidad': '200', 'p_ord_fecha_entrega': '2026-03-30', 'p_ord_estado': 'Planificada', 'p_ord_precio_ton': '1950', 'p_ord_prioridad': 'Normal' }
    },
    {
        id: 'r_ord_5', entityId: 'ent_ordenes',
        values: { 'p_ord_codigo': 'OP-2026-005', 'p_ord_cliente': 'CEPSA Química', 'p_ord_producto': 'Film HDPE 100μm', 'p_ord_cantidad': '600', 'p_ord_fecha_entrega': '2026-04-10', 'p_ord_estado': 'Planificada', 'p_ord_precio_ton': '1900', 'p_ord_prioridad': 'Baja' }
    },
    {
        id: 'r_ord_6', entityId: 'ent_ordenes',
        values: { 'p_ord_codigo': 'OP-2026-006', 'p_ord_cliente': 'Saudi Aramco Products', 'p_ord_producto': 'Contenedor HDPE 200L', 'p_ord_cantidad': '1200', 'p_ord_fecha_entrega': '2026-05-01', 'p_ord_estado': 'Planificada', 'p_ord_precio_ton': '2050', 'p_ord_prioridad': 'Alta' }
    }
];

// ============================================================================
// WORKFLOW: Simulación de Producción de Plástico
// ============================================================================

const workflowId = 'wf_plastics_sim';

const workflowData = {
    nodes: [
        // Trigger
        { id: 'n_trigger', type: 'trigger', label: 'Iniciar Simulación', x: 80, y: 300 },

        // Manual Inputs (parámetros del Lab)
        { id: 'n_precio_resina', type: 'manualInput', label: 'Precio Resina (USD/ton)', x: 300, y: 100, config: { inputVarName: 'precio_resina', inputVarValue: '1350' } },
        { id: 'n_capacidad_planta', type: 'manualInput', label: 'Capacidad Planta (ton/día)', x: 300, y: 220, config: { inputVarName: 'capacidad_planta', inputVarValue: '400' } },
        { id: 'n_eficiencia', type: 'manualInput', label: 'Eficiencia Operativa (%)', x: 300, y: 340, config: { inputVarName: 'eficiencia', inputVarValue: '90' } },
        { id: 'n_precio_venta', type: 'manualInput', label: 'Precio Venta (USD/ton)', x: 300, y: 460, config: { inputVarName: 'precio_venta', inputVarValue: '1900' } },
        { id: 'n_dias_operacion', type: 'manualInput', label: 'Días Operación/Mes', x: 300, y: 580, config: { inputVarName: 'dias_operacion', inputVarValue: '25' } },

        // Fetch real data
        { id: 'n_fetch_produccion', type: 'fetchData', label: 'Datos Producción Real', x: 560, y: 180, config: { entityId: 'ent_produccion', entityName: 'Producción Diaria' } },
        { id: 'n_fetch_ordenes', type: 'fetchData', label: 'Órdenes Activas', x: 560, y: 420, config: { entityId: 'ent_ordenes', entityName: 'Órdenes de Producción' } },

        // Python calculation node
        { id: 'n_calculo', type: 'python', label: 'Cálculo Simulación P&L', x: 820, y: 300, config: {
            pythonCode: `
# Simulación de Producción de Plástico - Oil & Gas
import json

# Leer parámetros de entrada
precio_resina = float(inputs.get('precio_resina', 1350))
capacidad_planta = float(inputs.get('capacidad_planta', 400))
eficiencia = float(inputs.get('eficiencia', 90)) / 100
precio_venta = float(inputs.get('precio_venta', 1900))
dias_operacion = int(inputs.get('dias_operacion', 25))

# Producción efectiva
produccion_diaria = capacidad_planta * eficiencia
produccion_mensual = produccion_diaria * dias_operacion

# Costos
costo_resina = produccion_mensual * precio_resina
costo_energia = produccion_mensual * 45  # USD 45/ton en energía
costo_mano_obra = 180000  # USD fijo mensual
costo_mantenimiento = produccion_mensual * 12  # USD 12/ton
costo_total = costo_resina + costo_energia + costo_mano_obra + costo_mantenimiento

# Ingresos
ingresos = produccion_mensual * precio_venta
beneficio = ingresos - costo_total
margen = (beneficio / ingresos) * 100 if ingresos > 0 else 0

# Proyección 12 meses
proyeccion_mensual = []
for mes in range(1, 13):
    factor_estacional = 1.0 + 0.05 * (1 if mes in [3,4,5,9,10,11] else -0.02)
    prod_mes = produccion_mensual * factor_estacional
    ing_mes = prod_mes * precio_venta
    cost_mes = prod_mes * precio_resina + prod_mes * 45 + costo_mano_obra + prod_mes * 12
    ben_mes = ing_mes - cost_mes
    proyeccion_mensual.append({
        'name': f'Mes {mes}',
        'produccion': round(prod_mes, 0),
        'ingresos': round(ing_mes, 0),
        'costos': round(cost_mes, 0),
        'beneficio': round(ben_mes, 0)
    })

# Desglose de costos
desglose_costos = [
    { 'name': 'Resina/Feedstock', 'value': round(costo_resina, 0) },
    { 'name': 'Energía', 'value': round(costo_energia, 0) },
    { 'name': 'Mano de Obra', 'value': round(costo_mano_obra, 0) },
    { 'name': 'Mantenimiento', 'value': round(costo_mantenimiento, 0) }
]

# Resultado
result = {
    'produccion_mensual': round(produccion_mensual, 0),
    'ingresos': round(ingresos, 0),
    'costo_total': round(costo_total, 0),
    'beneficio': round(beneficio, 0),
    'margen': round(margen, 1),
    'costo_por_ton': round(costo_total / produccion_mensual, 0) if produccion_mensual > 0 else 0,
    'proyeccion_mensual': proyeccion_mensual,
    'desglose_costos': desglose_costos,
    'ingresos_anuales': round(sum(m['ingresos'] for m in proyeccion_mensual), 0),
    'beneficio_anual': round(sum(m['beneficio'] for m in proyeccion_mensual), 0)
}

output = result
`
        }},

        // Output
        { id: 'n_output', type: 'output', label: 'Resultados Simulación', x: 1080, y: 300 }
    ],
    connections: [
        // Trigger -> inputs
        { id: 'c1', fromNodeId: 'n_trigger', toNodeId: 'n_precio_resina' },
        { id: 'c2', fromNodeId: 'n_trigger', toNodeId: 'n_capacidad_planta' },
        { id: 'c3', fromNodeId: 'n_trigger', toNodeId: 'n_eficiencia' },
        { id: 'c4', fromNodeId: 'n_trigger', toNodeId: 'n_precio_venta' },
        { id: 'c5', fromNodeId: 'n_trigger', toNodeId: 'n_dias_operacion' },

        // Inputs -> fetch data
        { id: 'c6', fromNodeId: 'n_precio_resina', toNodeId: 'n_fetch_produccion' },
        { id: 'c7', fromNodeId: 'n_capacidad_planta', toNodeId: 'n_fetch_produccion' },
        { id: 'c8', fromNodeId: 'n_eficiencia', toNodeId: 'n_fetch_ordenes' },
        { id: 'c9', fromNodeId: 'n_precio_venta', toNodeId: 'n_fetch_ordenes' },

        // Fetch -> calculation
        { id: 'c10', fromNodeId: 'n_fetch_produccion', toNodeId: 'n_calculo' },
        { id: 'c11', fromNodeId: 'n_fetch_ordenes', toNodeId: 'n_calculo' },
        { id: 'c12', fromNodeId: 'n_dias_operacion', toNodeId: 'n_calculo' },

        // Calculation -> output
        { id: 'c13', fromNodeId: 'n_calculo', toNodeId: 'n_output' }
    ]
};

// ============================================================================
// SIMULACIÓN EN LAB
// ============================================================================

const simulationId = 'sim_plastics_prod';

const simulationData = {
    workflowId: workflowId,
    workflowName: 'Simulación Producción Plástico O&G',
    parameters: [
        {
            id: 'sp_precio_resina',
            nodeId: 'n_precio_resina',
            variableName: 'precio_resina',
            label: 'Precio Resina',
            description: 'Precio de la resina base HDPE/PP (USD por tonelada)',
            controlType: 'slider',
            config: { min: 800, max: 2500, step: 10, unit: 'USD/ton', defaultValue: 1350 },
            order: 0
        },
        {
            id: 'sp_capacidad',
            nodeId: 'n_capacidad_planta',
            variableName: 'capacidad_planta',
            label: 'Capacidad Planta',
            description: 'Capacidad total de producción diaria',
            controlType: 'slider',
            config: { min: 100, max: 800, step: 10, unit: 'ton/día', defaultValue: 400 },
            order: 1
        },
        {
            id: 'sp_eficiencia',
            nodeId: 'n_eficiencia',
            variableName: 'eficiencia',
            label: 'Eficiencia Operativa',
            description: 'OEE (Overall Equipment Effectiveness) de las líneas',
            controlType: 'slider',
            config: { min: 50, max: 100, step: 1, unit: '%', defaultValue: 90 },
            order: 2
        },
        {
            id: 'sp_precio_venta',
            nodeId: 'n_precio_venta',
            variableName: 'precio_venta',
            label: 'Precio Venta',
            description: 'Precio promedio de venta del producto terminado',
            controlType: 'slider',
            config: { min: 1200, max: 3500, step: 10, unit: 'USD/ton', defaultValue: 1900 },
            order: 3
        },
        {
            id: 'sp_dias',
            nodeId: 'n_dias_operacion',
            variableName: 'dias_operacion',
            label: 'Días Operación/Mes',
            description: 'Días operativos por mes (excluye paradas planificadas)',
            controlType: 'slider',
            config: { min: 15, max: 30, step: 1, unit: 'días', defaultValue: 25 },
            order: 4
        }
    ],
    visualizations: [
        { id: 'v_prod', type: 'kpi', title: 'Producción Mensual', dataMapping: { source: 'produccion_mensual', format: 'number' }, position: { x: 0, y: 0, w: 1, h: 1 }, color: '#5B7476' },
        { id: 'v_ing', type: 'kpi', title: 'Ingresos Mensuales', dataMapping: { source: 'ingresos', format: 'currency' }, position: { x: 1, y: 0, w: 1, h: 1 }, color: '#2563eb' },
        { id: 'v_ben', type: 'kpi', title: 'Beneficio Mensual', dataMapping: { source: 'beneficio', format: 'currency' }, position: { x: 2, y: 0, w: 1, h: 1 }, color: '#16a34a' },
        { id: 'v_mar', type: 'kpi', title: 'Margen', dataMapping: { source: 'margen', format: 'percent' }, position: { x: 3, y: 0, w: 1, h: 1 }, color: '#9333ea' },
        { id: 'v_proy', type: 'line', title: 'Proyección 12 Meses', dataMapping: { source: 'proyeccion_mensual', xAxis: 'name', yAxis: ['ingresos', 'costos', 'beneficio'], format: 'currency' }, position: { x: 0, y: 1, w: 2, h: 1 }, color: '#5B7476' },
        { id: 'v_costos', type: 'pie', title: 'Desglose de Costos', dataMapping: { source: 'desglose_costos', labelKey: 'name', valueKey: 'value', format: 'currency' }, position: { x: 2, y: 1, w: 2, h: 1 }, color: '#f59e0b' }
    ],
    savedScenarios: [
        {
            id: 'sc_base',
            name: 'Escenario Base',
            description: 'Operación normal con precios actuales de mercado',
            parameterValues: { 'sp_precio_resina': 1350, 'sp_capacidad': 400, 'sp_eficiencia': 90, 'sp_precio_venta': 1900, 'sp_dias': 25 },
            createdAt: new Date().toISOString()
        },
        {
            id: 'sc_crisis',
            name: 'Crisis Petróleo (resina cara)',
            description: 'Escenario con precio de resina alto por crisis de crudo',
            parameterValues: { 'sp_precio_resina': 2200, 'sp_capacidad': 400, 'sp_eficiencia': 85, 'sp_precio_venta': 2400, 'sp_dias': 22 },
            createdAt: new Date().toISOString()
        },
        {
            id: 'sc_max',
            name: 'Máxima Capacidad',
            description: 'Todas las líneas al máximo, turnos completos',
            parameterValues: { 'sp_precio_resina': 1350, 'sp_capacidad': 700, 'sp_eficiencia': 95, 'sp_precio_venta': 1900, 'sp_dias': 28 },
            createdAt: new Date().toISOString()
        }
    ],
    runs: []
};

// ============================================================================
// SEED FUNCTION
// ============================================================================

async function seedPlasticsPlant() {
    const db = await initDb();
    const now = new Date().toISOString();

    console.log('========================================');
    console.log('  Seed: Planta de Plástico - Oil & Gas');
    console.log('========================================\n');

    // Auto-detect first organization
    const org = await db.get('SELECT id, name FROM organizations LIMIT 1');
    if (!org) {
        console.error('ERROR: No organizations found. Run the main seed first or create a user.');
        process.exit(1);
    }
    ORG_ID = org.id;
    console.log(`Organización detectada: "${org.name}" (${ORG_ID})\n`);

    // --- Entidades ---
    console.log('Creando entidades...');
    for (const entity of entities) {
        // Delete existing if any
        await db.run('DELETE FROM entities WHERE id = ?', [entity.id]);
        
        await db.run(
            'INSERT INTO entities (id, organizationId, name, description, author, lastEdited, entityType) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [entity.id, ORG_ID, entity.name, entity.description, entity.author, entity.lastEdited, 'generic']
        );
        console.log(`  + ${entity.name} (${entity.properties.length} propiedades)`);

        for (const prop of entity.properties) {
            await db.run(
                'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [prop.id, entity.id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId || null, prop.unit || null]
            );
        }
    }

    // --- Registros ---
    console.log('\nCreando registros con datos...');
    let recordCount = 0;
    for (const record of records) {
        // Delete existing if any
        await db.run('DELETE FROM records WHERE id = ?', [record.id]);

        await db.run(
            'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
            [record.id, record.entityId, now]
        );

        for (const [propId, value] of Object.entries(record.values)) {
            const valId = 'rv_' + Math.random().toString(36).substr(2, 9);
            await db.run(
                'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                [valId, record.id, propId, String(value)]
            );
        }
        recordCount++;
    }
    console.log(`  + ${recordCount} registros creados`);

    // --- Workflow ---
    console.log('\nCreando workflow de simulación...');
    await db.run('DELETE FROM workflows WHERE id = ?', [workflowId]);
    
    // Find first user in org
    const user = await db.get(
        'SELECT u.id, u.name FROM users u JOIN user_organizations uo ON u.id = uo.userId WHERE uo.organizationId = ?',
        [ORG_ID]
    );
    
    await db.run(
        'INSERT INTO workflows (id, organizationId, name, data, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [workflowId, ORG_ID, 'Simulación Producción Plástico O&G', JSON.stringify(workflowData), JSON.stringify(['simulación', 'plástico', 'oil-gas', 'producción']), now, now]
    );
    console.log(`  + Workflow: Simulación Producción Plástico O&G`);
    console.log(`    ${workflowData.nodes.length} nodos, ${workflowData.connections.length} conexiones`);

    // --- Simulación en Lab ---
    console.log('\nCreando experimento en Lab...');
    await db.run('DELETE FROM simulations WHERE id = ?', [simulationId]);
    await db.run(
        'INSERT INTO simulations (id, organizationId, name, description, sourceEntities, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
            simulationId,
            ORG_ID,
            'Producción Plástico O&G',
            'Simulación de P&L de planta de producción de polietileno/polipropileno para sector Oil & Gas. Ajusta precio de resina, capacidad, eficiencia y precio de venta para ver proyecciones.',
            JSON.stringify(simulationData),
            now,
            now
        ]
    );
    console.log(`  + Experimento: Producción Plástico O&G`);
    console.log(`    ${simulationData.parameters.length} parámetros, ${simulationData.visualizations.length} visualizaciones, ${simulationData.savedScenarios.length} escenarios`);

    console.log('\n========================================');
    console.log('  Seed completado!');
    console.log('========================================');
    console.log('\nEntidades creadas:');
    entities.forEach(e => console.log(`  - ${e.name}: ${records.filter(r => r.entityId === e.id).length} registros`));
    console.log(`\nWorkflow: "Simulación Producción Plástico O&G"`);
    console.log(`Lab: "Producción Plástico O&G" con 3 escenarios guardados`);
    console.log('\nAbre Lab en la app para usar la simulación.');
}

seedPlasticsPlant().catch(err => {
    console.error('Error en seed:', err);
    process.exit(1);
});
