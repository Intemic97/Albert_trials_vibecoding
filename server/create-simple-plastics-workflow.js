/**
 * Create ultra-simple workflow that actually works
 * Topology: Trigger -> ManualInput -> FetchData -> Output
 */

const { initDb } = require('./db');

const workflowId = 'wf_plastics_simple';

const workflowData = {
    nodes: [
        { id: 'n_trig', type: 'trigger', label: 'Start', x: 100, y: 300 },
        { id: 'n_param', type: 'manualInput', label: 'Capacidad Target (ton/día)', x: 320, y: 300,
          config: { inputVarName: 'capacidad_target', inputVarValue: '400', variableName: 'capacidad_target', value: '400' } 
        },
        { id: 'n_fetch', type: 'fetchData', label: 'Fetch Extrusoras', x: 560, y: 300,
          config: { entityId: 'ent_extrusoras', entityName: 'Extrusoras' } 
        },
        { id: 'n_out', type: 'output', label: 'Output', x: 800, y: 300 }
    ],
    connections: [
        { id: 'c1', fromNodeId: 'n_trig', toNodeId: 'n_param' },
        { id: 'c2', fromNodeId: 'n_param', toNodeId: 'n_fetch' },
        { id: 'c3', fromNodeId: 'n_fetch', toNodeId: 'n_out' }
    ]
};

async function createWorkflow() {
    const db = await initDb();
    const now = new Date().toISOString();
    
    // Delete if exists
    await db.run('DELETE FROM workflows WHERE id = ?', [workflowId]);
    await db.run('DELETE FROM simulations WHERE workflowId = ?', [workflowId]);
    
    // Create workflow
    await db.run(
        'INSERT INTO workflows (id, organizationId, name, data, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [workflowId, '4y5mdgmfo', 'Test Simple - Extrusoras', JSON.stringify(workflowData), JSON.stringify(['test', 'simple']), now, now]
    );
    
    // Create simulation
    const simData = {
        workflowId: workflowId,
        workflowName: 'Test Simple - Extrusoras',
        parameters: [{
            id: 'p1',
            nodeId: 'n_param',
            variableName: 'capacidad_target',
            label: 'Capacidad Target',
            description: 'Capacidad objetivo de producción',
            controlType: 'slider',
            config: { min: 100, max: 800, step: 10, unit: 'ton/día', defaultValue: 400 },
            order: 0
        }],
        visualizations: [],
        savedScenarios: [],
        runs: []
    };
    
    await db.run(
        'INSERT INTO simulations (id, organizationId, name, description, sourceEntities, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        ['sim_test_simple', '4y5mdgmfo', 'Test Simple - Extrusoras', 'Workflow simple para probar que Lab ejecuta workflows reales', JSON.stringify(simData), now, now]
    );
    
    console.log('✓ Workflow simple creado: "Test Simple - Extrusoras"');
    console.log('✓ Simulación creada: "Test Simple - Extrusoras"');
    console.log('\n  Este workflow tiene 1 input y fetch datos reales de Extrusoras');
    console.log('  Ve a Lab y ejecuta esta simulación para verificar que funciona');
}

createWorkflow().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
