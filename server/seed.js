const { initDb } = require('./db');
const bcrypt = require('bcrypt');

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
    }
];

const communityEntities = [
    {
        id: 'c1',
        name: 'Public Templates',
        description: 'Shared community templates.',
        author: 'System',
        lastEdited: 'Today',
        properties: [{ id: 'cp1', name: 'Template Name', type: 'text', defaultValue: 'T-100' }]
    }
];

async function seed() {
    const db = await initDb();

    console.log('Clearing database...');
    // Clear all tables to ensure clean state
    await db.run('DELETE FROM record_values');
    await db.run('DELETE FROM records');
    await db.run('DELETE FROM properties');
    await db.run('DELETE FROM entities');
    await db.run('DELETE FROM user_organizations');
    await db.run('DELETE FROM organizations');
    await db.run('DELETE FROM users');

    console.log('Creating organizations...');
    const now = new Date().toISOString();
    const org1Id = 'org_intemic';
    const org2Id = 'org_community';

    await db.run('INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)', org1Id, 'Intemic', now);
    await db.run('INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)', org2Id, 'Community', now);

    console.log('Creating user...');
    const userId = 'user_albert';
    const hashedPassword = await bcrypt.hash('password123', 10);

    await db.run(
        'INSERT INTO users (id, email, password, name, createdAt) VALUES (?, ?, ?, ?, ?)',
        userId, 'u@example.com', hashedPassword, 'Albert Mestre', now
    );

    console.log('Linking user to organizations...');
    // Link to Intemic (Admin)
    await db.run(
        'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
        userId, org1Id, 'admin'
    );
    // Link to Community (Member)
    await db.run(
        'INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)',
        userId, org2Id, 'member'
    );

    console.log('Seeding entities for Intemic...');
    for (const entity of initialEntities) {
        await db.run(
            'INSERT INTO entities (id, organizationId, name, description, author, lastEdited) VALUES (?, ?, ?, ?, ?, ?)',
            entity.id, org1Id, entity.name, entity.description, entity.author, entity.lastEdited
        );

        for (const prop of entity.properties) {
            await db.run(
                'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
                prop.id, entity.id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId
            );
        }
    }

    console.log('Seeding entities for Community...');
    for (const entity of communityEntities) {
        await db.run(
            'INSERT INTO entities (id, organizationId, name, description, author, lastEdited) VALUES (?, ?, ?, ?, ?, ?)',
            entity.id, org2Id, entity.name, entity.description, entity.author, entity.lastEdited
        );

        for (const prop of entity.properties) {
            await db.run(
                'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
                prop.id, entity.id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId
            );
        }
    }

    console.log('Seeding complete!');
    console.log('-----------------------------------');
    console.log('User Credentials:');
    console.log('Email: u@example.com');
    console.log('Password: password123');
    console.log('-----------------------------------');
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
