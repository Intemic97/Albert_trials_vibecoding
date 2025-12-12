const { initDb } = require('./db');
const bcrypt = require('bcrypt');

const ORG_ID = 'org_intemic';

const entities = [
    {
        id: 'ent_factory',
        name: 'Factories',
        description: 'Manufacturing plants and facilities.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_fact_name', name: 'Factory Name', type: 'text', defaultValue: 'New Factory' },
            { id: 'p_fact_loc', name: 'Location', type: 'text', defaultValue: '' },
            { id: 'p_fact_owner', name: 'Owner', type: 'text', defaultValue: 'Intemic Corp' }
        ]
    },
    {
        id: 'ent_maint',
        name: 'Maintenance',
        description: 'Maintenance logs and schedules.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_maint_type', name: 'Type', type: 'text', defaultValue: 'Routine' }, // e.g. Repair, Inspection
            { id: 'p_maint_date', name: 'Date', type: 'text', defaultValue: '2025-01-01' },
            { id: 'p_maint_cost', name: 'Cost', type: 'number', defaultValue: 0 }
        ]
    },
    {
        id: 'ent_customer',
        name: 'Customers',
        description: 'Client database.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_cust_name', name: 'Customer Name', type: 'text', defaultValue: 'New Client' },
            { id: 'p_cust_email', name: 'Email', type: 'text', defaultValue: '' },
            { id: 'p_cust_region', name: 'Region', type: 'text', defaultValue: 'Global' }
        ]
    },
    {
        id: 'ent_equip',
        name: 'Equipment',
        description: 'Machinery and assets.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_equip_name', name: 'Equipment Name', type: 'text', defaultValue: 'New Machine' },
            { id: 'p_equip_sn', name: 'Serial Number', type: 'text', defaultValue: '' },
            { id: 'p_equip_fact', name: 'Located In', type: 'relation', relatedEntityId: 'ent_factory' },
            { id: 'p_equip_maint', name: 'Maintenance History', type: 'relation', relatedEntityId: 'ent_maint' }
        ]
    },
    {
        id: 'ent_prod',
        name: 'Products',
        description: 'Manufactured goods.',
        author: 'System',
        lastEdited: 'Today',
        properties: [
            { id: 'p_prod_name', name: 'Product Name', type: 'text', defaultValue: 'New Product' },
            { id: 'p_prod_specs', name: 'Specs', type: 'text', defaultValue: '' },
            { id: 'p_prod_fact', name: 'Manufactured At', type: 'relation', relatedEntityId: 'ent_factory' },
            { id: 'p_prod_cust', name: 'Customers', type: 'relation', relatedEntityId: 'ent_customer' }
        ]
    }
];

const sampleRecords = [
    // Factories
    {
        id: 'r_fact_1', entityId: 'ent_factory',
        values: { 'p_fact_name': 'Alpha Plant', 'p_fact_loc': 'Detroit, MI', 'p_fact_owner': 'Intemic Inc.' }
    },
    {
        id: 'r_fact_2', entityId: 'ent_factory',
        values: { 'p_fact_name': 'Beta Facility', 'p_fact_loc': 'Austin, TX', 'p_fact_owner': 'Intemic Inc.' }
    },

    // Maintenance Logs
    {
        id: 'r_maint_1', entityId: 'ent_maint',
        values: { 'p_maint_type': 'Oil Change', 'p_maint_date': '2025-06-15', 'p_maint_cost': '150' }
    },
    {
        id: 'r_maint_2', entityId: 'ent_maint',
        values: { 'p_maint_type': 'Calibration', 'p_maint_date': '2025-07-20', 'p_maint_cost': '500' }
    },

    // Customers
    {
        id: 'r_cust_1', entityId: 'ent_customer',
        values: { 'p_cust_name': 'Acme Corp', 'p_cust_email': 'contact@acme.com', 'p_cust_region': 'North America' }
    },
    {
        id: 'r_cust_2', entityId: 'ent_customer',
        values: { 'p_cust_name': 'Global Tech', 'p_cust_email': 'info@globaltech.io', 'p_cust_region': 'Europe' }
    },

    // Equipment (Linked to Factory and Maintenance)
    {
        id: 'r_equip_1', entityId: 'ent_equip',
        values: {
            'p_equip_name': 'CNC Lathe X1',
            'p_equip_sn': 'SN-1001',
            'p_equip_fact': JSON.stringify(['r_fact_1']), // In Alpha Plant
            'p_equip_maint': JSON.stringify(['r_maint_1', 'r_maint_2']) // Has 2 logs
        }
    },
    {
        id: 'r_equip_2', entityId: 'ent_equip',
        values: {
            'p_equip_name': 'Hydraulic Press',
            'p_equip_sn': 'SN-2044',
            'p_equip_fact': JSON.stringify(['r_fact_2']), // In Beta Facility
            'p_equip_maint': JSON.stringify([])
        }
    },

    // Products (Linked to Factory and Customer)
    {
        id: 'r_prod_1', entityId: 'ent_prod',
        values: {
            'p_prod_name': 'Model X Widget',
            'p_prod_specs': 'Steel, 10mm',
            'p_prod_fact': JSON.stringify(['r_fact_1']), // Made in Alpha
            'p_prod_cust': JSON.stringify(['r_cust_1']) // Sold to Acme
        }
    },
    {
        id: 'r_prod_2', entityId: 'ent_prod',
        values: {
            'p_prod_name': 'Pro Series Panel',
            'p_prod_specs': 'Aluminum, 50x50',
            'p_prod_fact': JSON.stringify(['r_fact_2']), // Made in Beta
            'p_prod_cust': JSON.stringify(['r_cust_1', 'r_cust_2']) // Sold to both
        }
    }
];

async function seed() {
    const db = await initDb();

    console.log('Clearing database for seed...');
    // We manually clear here because initDb no longer drops tables automatically
    const tables = ['record_values', 'records', 'properties', 'entities', 'workflows', 'user_organizations', 'organizations', 'users'];
    for (const table of tables) {
        await db.run(`DELETE FROM ${table}`);
    }

    console.log('Creating organizations...');
    const now = new Date().toISOString();
    await db.run('INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)', ORG_ID, 'Intemic', now);
    await db.run('INSERT INTO organizations (id, name, createdAt) VALUES (?, ?, ?)', 'org_community', 'Community', now);

    console.log('Creating user...');
    const userId = 'user_albert';
    const hashedPassword = await bcrypt.hash('password123', 10);
    await db.run(
        'INSERT INTO users (id, email, password, name, createdAt) VALUES (?, ?, ?, ?, ?)',
        userId, 'u@example.com', hashedPassword, 'Albert Mestre', now
    );

    console.log('Linking user...');
    await db.run('INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)', userId, ORG_ID, 'admin');
    await db.run('INSERT INTO user_organizations (userId, organizationId, role) VALUES (?, ?, ?)', userId, 'org_community', 'member');

    console.log('Seeding Entities...');
    for (const entity of entities) {
        await db.run(
            'INSERT INTO entities (id, organizationId, name, description, author, lastEdited) VALUES (?, ?, ?, ?, ?, ?)',
            entity.id, ORG_ID, entity.name, entity.description, entity.author, entity.lastEdited
        );

        for (const prop of entity.properties) {
            await db.run(
                'INSERT INTO properties (id, entityId, name, type, defaultValue, relatedEntityId) VALUES (?, ?, ?, ?, ?, ?)',
                prop.id, entity.id, prop.name, prop.type, prop.defaultValue, prop.relatedEntityId
            );
        }
    }

    console.log('Seeding Records...');
    for (const record of sampleRecords) {
        await db.run(
            'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
            record.id, record.entityId, now
        );

        for (const [propId, value] of Object.entries(record.values)) {
            const valId = Math.random().toString(36).substr(2, 9);
            await db.run(
                'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                valId, record.id, propId, String(value)
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
