/**
 * Importador genérico de Use Case Package.
 * Crea/sobrescribe entidades, registros, workflow, simulación Lab y opcionalmente dashboard.
 * Usado por el script CLI y por POST /api/use-case/import.
 */

function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

function buildSummary(pkg) {
    return {
        entities: Array.isArray(pkg.entities) ? pkg.entities.length : 0,
        records: Array.isArray(pkg.records) ? pkg.records.length : 0,
        workflow: !!(pkg.workflow && pkg.workflow.id && pkg.workflow.data),
        simulation: !!(pkg.simulation && pkg.simulation.id),
        dashboard: !!(pkg.dashboard && pkg.dashboard.id && pkg.dashboard.name)
    };
}

function validateUseCasePackage(pkg) {
    const errors = [];
    const warnings = [];

    if (!pkg || typeof pkg !== 'object') {
        errors.push('El package debe ser un objeto JSON.');
        return { valid: false, errors, warnings, summary: buildSummary({}) };
    }

    if (!Array.isArray(pkg.entities) || pkg.entities.length === 0) {
        warnings.push('No se incluyen entidades. Se importarán solo las secciones presentes.');
    }

    // Guard rail: avoid "successful" imports when user uploads a Knowledge Base JSON
    // (folders/documents) into the Use Case importer endpoint.
    const looksLikeKnowledgeBase =
        Array.isArray(pkg.folders) || Array.isArray(pkg.documents);
    const hasUseCaseSections =
        (Array.isArray(pkg.entities) && pkg.entities.length > 0) ||
        (Array.isArray(pkg.records) && pkg.records.length > 0) ||
        !!(pkg.workflow && pkg.workflow.id && pkg.workflow.data) ||
        !!(pkg.simulation && pkg.simulation.id) ||
        !!(pkg.dashboard && pkg.dashboard.id && pkg.dashboard.name);
    if (looksLikeKnowledgeBase && !hasUseCaseSections) {
        errors.push('Este JSON parece de Knowledge Base (folders/documents) y no de Use Case (entities/records/workflow/simulation/dashboard).');
    }

    if (!hasUseCaseSections) {
        errors.push('El package no incluye ninguna sección importable. Añade al menos entities, records, workflow, simulation o dashboard.');
    }

    if (Array.isArray(pkg.entities)) {
        for (const [i, entity] of pkg.entities.entries()) {
            if (!entity?.id) errors.push(`entities[${i}].id es obligatorio`);
            if (!entity?.name) warnings.push(`entities[${i}] no tiene name; se usará id`);
            if (entity.properties && !Array.isArray(entity.properties)) {
                errors.push(`entities[${i}].properties debe ser array`);
            }
        }
    } else if (pkg.entities !== undefined) {
        errors.push('entities debe ser array');
    }

    if (Array.isArray(pkg.records)) {
        for (const [i, record] of pkg.records.entries()) {
            if (!record?.id) errors.push(`records[${i}].id es obligatorio`);
            if (!record?.entityId) errors.push(`records[${i}].entityId es obligatorio`);
            if (!record?.values || typeof record.values !== 'object' || Array.isArray(record.values)) {
                errors.push(`records[${i}].values debe ser objeto`);
            }
        }
    } else if (pkg.records !== undefined) {
        errors.push('records debe ser array');
    }

    if (pkg.workflow) {
        if (!pkg.workflow.id) errors.push('workflow.id es obligatorio');
        if (!pkg.workflow.data || typeof pkg.workflow.data !== 'object') errors.push('workflow.data es obligatorio');
        if (pkg.workflow.data && !Array.isArray(pkg.workflow.data.nodes)) warnings.push('workflow.data.nodes debería ser array');
        if (pkg.workflow.data && !Array.isArray(pkg.workflow.data.connections)) warnings.push('workflow.data.connections debería ser array');
    }

    if (pkg.simulation) {
        if (!pkg.simulation.id) errors.push('simulation.id es obligatorio');
        if (!pkg.simulation.workflowId) warnings.push('simulation.workflowId no definido');
    }

    if (pkg.dashboard) {
        if (!pkg.dashboard.id) errors.push('dashboard.id es obligatorio');
        if (!pkg.dashboard.name) errors.push('dashboard.name es obligatorio');
        if (pkg.dashboard.widgets && !Array.isArray(pkg.dashboard.widgets)) {
            errors.push('dashboard.widgets debe ser array');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        summary: buildSummary(pkg)
    };
}

/**
 * @param {object} db - Base de datos (sqlite)
 * @param {string} orgId - ID de organización
 * @param {object} packageObj - Objeto del package: { name?, version?, entities?, records?, workflow?, simulation?, dashboard? }
 * @param {string} [userId] - ID de usuario (para workflow/dashboard createdBy)
 * @returns {Promise<{ entities: number, records: number, workflow: boolean, simulation: boolean, dashboard: boolean }>}
 */
async function importUseCasePackage(db, orgId, packageObj, userId = null, options = {}) {
    const pkg = packageObj;
    if (!pkg || typeof pkg !== 'object') {
        throw new Error('importUseCasePackage(db, orgId, packageObj, userId?) requires package object');
    }
    const org = orgId;
    if (!org) throw new Error('orgId is required');
    const userIdVal = userId || null;
    const dryRun = !!options.dryRun;

    const validation = validateUseCasePackage(pkg);
    if (!validation.valid) {
        throw new Error(`Package inválido: ${validation.errors.join(' | ')}`);
    }

    const now = new Date().toISOString();
    const result = { ...validation.summary, dryRun, warnings: validation.warnings };
    if (dryRun) return result;

    // --- Entidades ---
    const entities = Array.isArray(pkg.entities) ? pkg.entities : [];
    for (const entity of entities) {
        await db.run('DELETE FROM entities WHERE id = ?', [entity.id]);
        await db.run(
            'INSERT INTO entities (id, organizationId, name, description, author, lastEdited, entityType) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [entity.id, org, entity.name || entity.id, entity.description || '', entity.author || 'Import', entity.lastEdited || now, entity.entityType || 'generic']
        );
        const properties = Array.isArray(entity.properties) ? entity.properties : [];
        for (const prop of properties) {
            await db.run(
                'INSERT OR REPLACE INTO properties (id, entityId, name, type, defaultValue, relatedEntityId, unit) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [prop.id, entity.id, prop.name || prop.id, prop.type || 'text', prop.defaultValue ?? '', prop.relatedEntityId || null, prop.unit || null]
            );
        }
    }

    // --- Registros ---
    const records = Array.isArray(pkg.records) ? pkg.records : [];
    for (const record of records) {
        await db.run('DELETE FROM records WHERE id = ?', [record.id]);
        await db.run(
            'INSERT INTO records (id, entityId, createdAt) VALUES (?, ?, ?)',
            [record.id, record.entityId, now]
        );
        const values = record.values && typeof record.values === 'object' ? record.values : {};
        for (const [propId, value] of Object.entries(values)) {
            const valId = 'rv_' + generateId();
            await db.run(
                'INSERT INTO record_values (id, recordId, propertyId, value) VALUES (?, ?, ?, ?)',
                [valId, record.id, propId, String(value)]
            );
        }
    }

    // --- Move imported entities into "Imported Examples" folder ---
    if (entities.length > 0) {
        try {
            const entityIds = entities.map(e => e.id);
            const existingFolder = await db.get(
                'SELECT * FROM knowledge_folders WHERE organizationId = ? AND name = ?',
                [org, 'Imported Examples']
            );
            
            if (existingFolder) {
                const currentEntityIds = existingFolder.entityIds ? JSON.parse(existingFolder.entityIds) : [];
                const mergedIds = [...new Set([...currentEntityIds, ...entityIds])];
                await db.run(
                    'UPDATE knowledge_folders SET entityIds = ?, updatedAt = ? WHERE id = ?',
                    [JSON.stringify(mergedIds), now, existingFolder.id]
                );
            } else {
                const folderId = 'fold_' + generateId();
                await db.run(
                    `INSERT INTO knowledge_folders (id, organizationId, name, description, color, parentId, documentIds, entityIds, createdBy, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [folderId, org, 'Imported Examples', 'Example entities created from imports', '#f59e0b', null, '[]', JSON.stringify(entityIds), userIdVal || '', now, now]
                );
            }
        } catch (folderErr) {
            // Non-critical: don't fail the entire import if folder creation fails
            console.error('Could not organize imported entities into folder:', folderErr);
        }
    }

    // --- Workflow ---
    const workflow = pkg.workflow;
    if (workflow && workflow.id && workflow.data) {
        await db.run('DELETE FROM workflows WHERE id = ?', [workflow.id]);
        const name = workflow.name || workflow.id;
        const tags = workflow.tags != null ? JSON.stringify(Array.isArray(workflow.tags) ? workflow.tags : []) : null;
        try {
            await db.run(
                `INSERT INTO workflows (id, organizationId, name, data, tags, createdAt, updatedAt, createdBy, createdByName) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [workflow.id, org, name, JSON.stringify(workflow.data), tags, now, now, userIdVal || '', userIdVal ? 'Import' : 'System']
            );
        } catch (e) {
            if (e.message && e.message.includes('createdBy')) {
                await db.run(
                    'INSERT INTO workflows (id, organizationId, name, data, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [workflow.id, org, name, JSON.stringify(workflow.data), tags, now, now]
                );
            } else throw e;
        }
    }

    // --- Simulación Lab ---
    const simulation = pkg.simulation;
    if (simulation && simulation.id) {
        await db.run('DELETE FROM simulations WHERE id = ?', [simulation.id]);
        const simData = {
            workflowId: simulation.workflowId,
            workflowName: simulation.workflowName,
            parameters: simulation.parameters || [],
            visualizations: simulation.visualizations || [],
            savedScenarios: simulation.savedScenarios || [],
            runs: simulation.runs || [],
            calculationCode: simulation.calculationCode
        };
        try {
            await db.run(
                `INSERT INTO simulations (id, organizationId, name, description, sourceEntities, variables, scenariosData, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [simulation.id, org, simulation.name || simulation.id, simulation.description || '', JSON.stringify(simData), '[]', '[]', now, now]
            );
        } catch (e) {
            await db.run(
                'INSERT INTO simulations (id, organizationId, name, description, sourceEntities, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [simulation.id, org, simulation.name || simulation.id, simulation.description || '', JSON.stringify(simData), now, now]
            );
        }
    }

    // --- Dashboard (opcional) ---
    const dashboard = pkg.dashboard;
    if (dashboard && dashboard.id && dashboard.name) {
        await db.run('DELETE FROM dashboards WHERE id = ?', [dashboard.id]);
        await db.run(
            'INSERT INTO dashboards (id, organizationId, name, description, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [dashboard.id, org, dashboard.name, dashboard.description || '', userIdVal || '', now, now]
        );
        const widgets = Array.isArray(dashboard.widgets) ? dashboard.widgets : [];
        let position = 0;
        for (const w of widgets) {
            const wid = w.id || 'w_' + generateId();
            await db.run(
                'INSERT INTO widgets (id, dashboardId, title, description, config, position, gridX, gridY, gridWidth, gridHeight, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [wid, dashboard.id, w.title || wid, w.description || '', JSON.stringify(w.config || {}), position++, w.gridX ?? 0, w.gridY ?? 0, w.gridWidth ?? 4, w.gridHeight ?? 3, now]
            );
        }
    }

    return result;
}

module.exports = { importUseCasePackage, validateUseCasePackage, generateId };
