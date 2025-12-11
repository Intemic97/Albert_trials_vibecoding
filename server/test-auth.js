const { strict: assert } = require('assert');

const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
    console.log('Starting Authentication & Multi-tenancy Tests...');

    // 1. Register User A (Org A)
    console.log('\n1. Registering User A (Org A)...');
    const userAEmail = `alice_${Date.now()}@test.com`;
    const resA = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: userAEmail,
            password: 'password123',
            name: 'Alice',
            orgName: 'Org A'
        })
    });

    if (!resA.ok) throw new Error(`User A registration failed: ${resA.statusText}`);
    const dataA = await resA.json();
    // Extract cookies manually since fetch in Node doesn't handle cookie jar automatically
    const cookieA = resA.headers.get('set-cookie');
    console.log('User A registered:', dataA.user.email);

    // 2. Register User B (Org B)
    console.log('\n2. Registering User B (Org B)...');
    const userBEmail = `bob_${Date.now()}@test.com`;
    const resB = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: userBEmail,
            password: 'password123',
            name: 'Bob',
            orgName: 'Org B'
        })
    });

    if (!resB.ok) throw new Error(`User B registration failed: ${resB.statusText}`);
    const dataB = await resB.json();
    const cookieB = resB.headers.get('set-cookie');
    console.log('User B registered:', dataB.user.email);

    // 3. User A creates Entity A
    console.log('\n3. User A creating Entity A...');
    const entityAId = `entity_a_${Date.now()}`;
    const resCreateA = await fetch(`${BASE_URL}/entities`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieA
        },
        body: JSON.stringify({
            id: entityAId,
            name: 'Entity A',
            description: 'Confidential Project A',
            author: 'Alice',
            lastEdited: new Date().toISOString()
        })
    });
    if (!resCreateA.ok) throw new Error(`Entity A creation failed: ${resCreateA.statusText}`);
    console.log('Entity A created');

    // 3.5 User A creates a Property for Entity A
    console.log('\n3.5 User A creating Property for Entity A...');
    const propId = `prop_a_${Date.now()}`;
    const resPropA = await fetch(`${BASE_URL}/properties`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieA
        },
        body: JSON.stringify({
            id: propId,
            entityId: entityAId,
            name: 'Test Property',
            type: 'text',
            defaultValue: ''
        })
    });
    if (!resPropA.ok) throw new Error(`Property creation failed: ${resPropA.statusText}`);
    console.log('Property created');

    // 4. User B tries to fetch entities (Should NOT see Entity A)
    console.log('\n4. User B fetching entities (Expect isolation)...');
    const resListB = await fetch(`${BASE_URL}/entities`, {
        headers: { 'Cookie': cookieB }
    });
    const entitiesB = await resListB.json();
    const foundA = entitiesB.find(e => e.id === entityAId);

    if (foundA) {
        throw new Error('TEST FAILED: User B can see Entity A!');
    } else {
        console.log('SUCCESS: User B cannot see Entity A.');
    }

    // 5. User B tries to create record for Entity A (Should fail)
    console.log('\n5. User B trying to create record for Entity A (Expect failure)...');
    const resRecordB = await fetch(`${BASE_URL}/records`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieB
        },
        body: JSON.stringify({
            entityId: entityAId,
            values: { [propId]: 'hacked' }
        })
    });

    if (resRecordB.status === 403 || resRecordB.status === 404) {
        console.log(`SUCCESS: User B blocked from creating record for Entity A (${resRecordB.status})`);
    } else {
        throw new Error(`TEST FAILED: User B was able to create record for Entity A! Status: ${resRecordB.status}`);
    }

    // 6. User A creates record for Entity A (Should succeed)
    console.log('\n6. User A creating record for Entity A...');
    const resRecordA = await fetch(`${BASE_URL}/records`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieA
        },
        body: JSON.stringify({
            entityId: entityAId,
            values: { [propId]: 'legit' }
        })
    });

    if (!resRecordA.ok) throw new Error(`User A failed to create record: ${resRecordA.statusText}`);
    const recordData = await resRecordA.json();
    console.log('Record created by User A');

    // 7. User B tries to fetch records for Entity A (Should fail)
    console.log('\n7. User B trying to fetch records for Entity A (Expect failure)...');
    const resGetRecordsB = await fetch(`${BASE_URL}/entities/${entityAId}/records`, {
        headers: { 'Cookie': cookieB }
    });

    if (resGetRecordsB.status === 403 || resGetRecordsB.status === 404) {
        console.log(`SUCCESS: User B blocked from reading records of Entity A (${resGetRecordsB.status})`);
    } else {
        const records = await resGetRecordsB.json();
        console.log('Records returned:', records);
        throw new Error(`TEST FAILED: User B was able to read records of Entity A! Status: ${resGetRecordsB.status}`);
    }

    console.log('\n---------------------------------------------------');
    console.log('ALL TESTS PASSED: Multi-tenancy isolation confirmed.');
    console.log('---------------------------------------------------');
}

runTests().catch(err => {
    console.error('\nTEST FAILED:', err.message);
    process.exit(1);
});
