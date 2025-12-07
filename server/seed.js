const { initDb } = require('./db');

const initialEntities = [
    {
        id: '1',
        name: 'Facilities/Factories',
        description: 'Main manufacturing locations and physical plant metadata.',
        author: 'albert_mestre',
        lastEdited: 'December 2, 2025',
        properties: [
            { id: 'p1', name: 'Factory Name', type: 'text', defaultValue: 'Main Plant A' },
            { id: 'p2', name: 'Capacity', type: 'number', defaultValue: 5000 },
        ]
    },
    {
        id: '2',
        name: 'Equipments',
        description: 'Individual machinery units within the facilities.',
        author: 'Mateo Alcazar',
        lastEdited: 'November 28, 2025',
        properties: [
            { id: 'p3', name: 'Serial Number', type: 'text', defaultValue: 'SN-99882' },
            { id: 'p4', name: 'Installation Year', type: 'number', defaultValue: 2020 },
            { id: 'p5', name: 'Located In', type: 'relation', relatedEntityId: '1' }
        ]
    },
    {
        id: '3',
        name: 'Formulations',
        description: 'Chemical recipes and composition standards.',
        author: 'albert_mestre',
        lastEdited: 'November 28, 2025',
        properties: [
            { id: 'p6', name: 'Formula Code', type: 'text', defaultValue: 'F-221' }
        ]
    },
    {
        id: '4',
        name: 'Customers',
        description: 'Client database and contact information.',
        author: 'albert_mestre',
        lastEdited: 'November 30, 2025',
        properties: []
    },
    {
        id: '5',
        name: 'Reports',
        description: 'Generated production reports.',
        author: 'System',
        lastEdited: 'December 1, 2025',
        properties: []
    },
    {
        id: '6',
        name: 'Alerts/Events',
        description: 'System generated anomalies and logs.',
        author: 'System',
        lastEdited: 'Today',
        properties: []
    }
];

async function seed() {
    const db = await initDb();

    console.log('Clearing database...');
    await db.run('DELETE FROM properties');
    await db.run('DELETE FROM entities');

    console.log('Seeding entities...');
    for (const entity of initialEntities) {
        await db.run(
            'INSERT INTO entities (id, name, description, author, lastEdited) VALUES (?, ?, ?, ?, ?)',
            entity.id, entity.name, entity.description, entity.author, entity.lastEdited
        );

        for (const prop of entity.properties) {
            await db.run(
                'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
                prop.id, entity.id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId
            );
        }
    }

    console.log('Seeding complete!');
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
