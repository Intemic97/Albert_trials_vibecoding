#!/usr/bin/env node
/**
 * Importa un Use Case Package desde un JSON.
 * Uso:
 *   node server/import-use-case.js                    # busca use-case-package.json en rutas por defecto
 *   node server/import-use-case.js path/to/file.json
 *
 * Rutas por defecto (en orden): use-case-package.json, server/data/use-case-package.json
 */

const path = require('path');
const fs = require('fs');
const { initDb } = require('./db');
const { importUseCasePackage } = require('./useCaseImporter');

const DEFAULT_PATHS = [
    path.join(process.cwd(), 'use-case-package.json'),
    path.join(process.cwd(), 'server', 'data', 'use-case-package.json'),
    path.join(process.cwd(), 'server', 'use-case-package.json'),
];

async function main() {
    const jsonPath = process.argv[2];
    const pathsToTry = jsonPath ? [path.resolve(process.cwd(), jsonPath)] : DEFAULT_PATHS;

    let resolvedPath = null;
    for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
            resolvedPath = p;
            break;
        }
    }

    if (!resolvedPath) {
        console.error('No se encontró el package JSON.');
        if (jsonPath) {
            console.error('  Ruta indicada:', jsonPath);
        } else {
            console.error('  Rutas probadas:', DEFAULT_PATHS.join(', '));
        }
        console.error('Uso: node server/import-use-case.js [ruta/use-case-package.json]');
        process.exit(1);
    }

    let packageObj;
    try {
        const raw = fs.readFileSync(resolvedPath, 'utf8');
        packageObj = JSON.parse(raw);
    } catch (e) {
        console.error('Error leyendo/parseando JSON:', e.message);
        process.exit(1);
    }

    const db = await initDb();
    const org = await db.get('SELECT id, name FROM organizations LIMIT 1');
    if (!org) {
        console.error('No hay organizaciones. Ejecuta antes el seed principal (npm run seed).');
        process.exit(1);
    }

    const user = await db.get(
        'SELECT u.id FROM users u JOIN user_organizations uo ON u.id = uo.userId WHERE uo.organizationId = ? LIMIT 1',
        [org.id]
    );

    try {
        const result = await importUseCasePackage(db, org.id, packageObj, user?.id || null);
        console.log('Use case importado:', resolvedPath);
        console.log('  Entidades:', result.entities);
        console.log('  Registros:', result.records);
        console.log('  Workflow:', result.workflow);
        console.log('  Simulación Lab:', result.simulation);
        console.log('  Dashboard:', result.dashboard);
    } catch (err) {
        console.error('Error en importación:', err.message);
        process.exit(1);
    }
}

main();
