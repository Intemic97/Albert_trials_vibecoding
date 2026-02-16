# Contexto de la plataforma – Intemic Structure Manager

Documento de contexto que reúne visión del producto, documentación de usuario, importación de casos de uso y seguridad. Útil para onboarding, ventas o integración con otras herramientas.

**Última actualización:** Febrero 2026

---

## 1. Visión y características

### 1.1 Qué es la plataforma

**Intemic Structure Manager** es una aplicación de gestión de datos que combina:

- **Modelado de entidades** – Estructuras de datos personalizables (entidades, propiedades, relaciones).
- **Base de conocimiento** – Entidades como “tablas” con registros, tipos de propiedad (texto, número, relación) e importación de datos.
- **Workflows** – Editor visual de flujos (trigger, fetch data, Excel/CSV, transformaciones, condiciones, envío de correo, webhooks, etc.).
- **Inteligencia (IA)** – Agentes configurables con instrucciones, acceso a datos y memoria de conversación; chat con menciones `@Entidad` e informes generados por IA.
- **Dashboards** – Paneles con widgets (KPI, gráficos) vinculados a entidades.
- **Lab** – Experimentos y simulaciones vinculados a workflows (parámetros, escenarios, visualizaciones).
- **Conexiones** – Integraciones con sistemas externos (APIs, bases de datos, etc.).
- **Multi-tenant** – Organizaciones, equipos, invitaciones y control de acceso.

Está pensada para entornos industriales, manufactura y producción (trazabilidad, calidad, KPIs, reportes).

### 1.2 Stack técnico (resumen)

| Capa      | Tecnología principal |
|----------|------------------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend  | Node.js, Express |
| Base de datos | SQLite (embebida) |
| IA       | OpenAI API (informes y agentes) |

### 1.3 Estructura de la aplicación (rutas principales)

- **Overview** – Página de inicio.
- **Inteligencia** – Chat con agentes IA, selector de agente, memoria, menciones.
- **Lab** – Experimentos y simulaciones.
- **Database / Knowledge Base** – Entidades, propiedades, registros.
- **Workflows** – Editor de flujos (canvas, nodos, conexiones).
- **Dashboards** – Paneles y widgets.
- **Documents** – Documentos vinculados al conocimiento.
- **Reports** – Informes generados por IA.
- **Settings** – General, equipo, integraciones, Activity Log.
- **Documentation** – Documentación de usuario integrada (esta doc la resume).

---

## 2. Documentación de usuario (resumen)

La aplicación incluye una sección **Documentation** con la siguiente estructura. Este documento es un resumen para contexto; el detalle está en la propia app.

### 2.1 Getting Started

- **What is Intemic?** – Descripción del producto y capacidades.
- **Your First Workflow** – Primer flujo: trigger y nodos básicos.

### 2.2 Knowledge Base

- **Core Concepts** – Entidades, propiedades, registros.
- **Property Types** – Text, number, relation, etc.
- **Relationships** – Relaciones entre entidades.
- **Import Data** – Cómo cargar datos (CSV, importación).
- **Use Cases** – Casos de uso típicos (seguimiento de lotes, KPIs, etc.).

### 2.3 Workflows

- **Canvas Basics** – Zoom, pan, selección, atajos.
- **Node Types** – Trigger (manual, programado), Fetch Data, Excel/CSV Input, transform, condition, join, send email, webhook.
- **Connecting Nodes** – Conexiones entre nodos.
- **Execution & Testing** – Ejecución y pruebas.
- **Templates** – Plantillas de workflow.

### 2.4 Inteligencia (IA)

- **Agents** – Crear y configurar agentes (nombre, instrucciones, acceso a entidades, memoria).
- **Chat** – Uso del chat, selector de agente, nueva conversación, opción de memoria.
- **Data Access Control** – Qué entidades puede consultar cada agente.
- **Using Mentions** – Uso de `@Entidad` en el chat.
- **AI Reports** – Informes generados por IA y exportación (PDF, Markdown).

### 2.5 Dashboards

- **Widget Types** – KPI, gráficos, tablas.
- **Data Sources** – Vinculación a entidades.
- **Filters & Refresh** – Filtros y actualización.
- **Sharing Dashboards** – Compartir paneles.

### 2.6 Connections

- **Available Connectors** – Conectores disponibles.
- **Configuration** – Cómo configurarlos.
- **Testing Connections** – Pruebas de conexión.

### 2.7 Lab

- **Creating Experiments** – Crear experimentos vinculados a workflows.
- **Variables & Parameters** – Parámetros y sliders.
- **Analysis & Results** – Análisis y resultados.
- **Comparing Scenarios** – Comparar escenarios guardados.

### 2.8 Settings & Admin

- **User Management** – Usuarios y equipos (Settings > Team).
- **Organizations** – Organizaciones y membresías.
- **Notifications** – Preferencias de notificaciones.

### 2.9 Security

- **Overview** – Login seguro, control de acceso, cifrado, cumplimiento.
- **Authentication & SSO** – Inicio de sesión y SSO (SAML/OIDC) para empresas.
- **Roles & Permissions** – Roles (Admin, Editor, Viewer, Auditor) y permisos por recurso.
- **Data Protection** – Cifrado de datos sensibles y buenas prácticas.
- **Privacy & Compliance** – Derechos de usuario (exportación, borrado, consentimiento) y GDPR.

### 2.10 Troubleshooting

- **Common Errors** – Página no carga, agente no responde, errores de importación, etc.
- **FAQ** – Preguntas frecuentes (exportar datos, permisos, etc.).

---

## 3. Importación de casos de uso (Import Package)

La pantalla **Import Package** solo acepta el formato **Use Case**, no el formato de Knowledge Base (folders/documents).

### 3.1 Qué acepta el importador

| Sección     | Descripción |
|------------|-------------|
| `entities` | Definiciones de entidades (id, name, properties). Obligatorio al menos 1 entidad si se importa modelo. |
| `records`  | Registros por entidad (id, entityId, values). Puede ser `[]`. |
| `workflow` | Un workflow (id, name, data.nodes, data.connections). Opcional. |
| `simulation` | Experimento Lab (id, workflowId, parameters, visualizations). Opcional. |
| `dashboard` | Dashboard (id, name, widgets). Opcional. |

**No usar** en este importador: `folders`, `documents` (formato Knowledge Base).

### 3.2 Estructura mínima del JSON

```json
{
  "name": "Mi paquete",
  "version": "1.0.0",
  "entities": [
    {
      "id": "ent_ejemplo",
      "name": "Ejemplo",
      "description": "Descripción opcional",
      "author": "System",
      "lastEdited": "Today",
      "properties": [
        { "id": "p_ej_nombre", "name": "Nombre", "type": "text", "defaultValue": "" },
        { "id": "p_ej_valor", "name": "Valor", "type": "number", "defaultValue": "0" }
      ]
    }
  ],
  "records": [
    {
      "id": "r_001",
      "entityId": "ent_ejemplo",
      "values": { "p_ej_nombre": "Item 1", "p_ej_valor": "10" }
    }
  ]
}
```

### 3.3 Reglas importantes

- **IDs únicos** en todo el paquete. Convención: `ent_` entidades, `p_` propiedades, `r_` registros, `n_` nodos, `c_` conexiones.
- **records[].entityId** debe coincidir con `entities[].id`.
- **records[].values**: claves = `propertyId`, valores = string o número.
- **workflow.data.nodes**: cada nodo con `id`, `type` (trigger, fetchData, excelInput, etc.), `label`, `x`, `y`; para fetchData, `config` con `selectedEntityId` y `selectedEntityName`.
- **workflow.data.connections**: `fromNodeId`, `toNodeId`.

### 3.4 Flujo recomendado

1. Generar o exportar el JSON del caso de uso.
2. Validar: `POST /api/use-case/validate` (body = JSON).
3. Probar sin escribir: `POST /api/use-case/import?dryRun=true` (body = JSON).
4. Importar en serio: desactivar dry run y enviar el JSON al import o usar la UI “Importar package”.

### 3.5 Crear JSON desde Excel u otras fuentes

En el repositorio hay un **prompt para GPT** que genera este tipo de JSON a partir de descripciones o tablas (p. ej. Excel):

- **Archivo:** `docs/PROMPT_GPT_CREAR_PAQUETE_CASO_DE_USO.md`
- Uso: copiar el bloque del prompt en un GPT y describir el caso (columnas Excel, entidades deseadas, workflow, etc.); el GPT devuelve el JSON listo para importar.

---

## 4. Seguridad (resumen)

Roadmap de seguridad para adopción en entornos enterprise (p. ej. Damm, Repsol). Detalle completo en `docs/SECURITY_ROADMAP.md`.

### 4.1 Estado actual (implementado)

- Autenticación JWT (cookies HTTP-only), bcrypt, política de contraseñas.
- Rate limiting, audit logs, multi-tenant por organización.
- Consultas parametrizadas (protección frente a inyección SQL).
- Helmet, CSP, HSTS.
- **SSO:** SAML 2.0 y OpenID Connect.
- **Cifrado:** campos sensibles con AES-256-GCM.
- **Secrets:** abstracción (env, AWS, Vault).
- **RBAC:** Admin, Editor, Viewer, Auditor con permisos por recurso.
- **GDPR:** derecho al olvido, exportación de datos, gestión de consentimientos.
- Pipeline CI/CD de seguridad (audit, escaneo de secretos, comprobaciones).

### 4.2 Fases pendientes (resumen)

- **Fase 2:** SOC 2 Type II, ISO 27001 (documentación, backups, pentesting).
- **Fase 3:** SAST, dependencias, SIEM, hardening Docker, WAF, backups cifrados.
- **Fase 4:** Opciones single-tenant, VPC, DLP, whitepaper de seguridad.

### 4.3 Requisitos típicos enterprise

Para empresas como Damm o Repsol se suele requerir como mínimo: **SSO + SOC 2 + GDPR + Pentest + DPA**.

---

## 5. Cómo obtener este documento en PDF

### Opción A – Desde el navegador (recomendado)

1. Abre en el navegador el archivo **`docs/CONTEXTO_PLATAFORMA.html`** (doble clic o arrastrar al Chrome/Edge).
2. Menú **Archivo → Imprimir** (o Ctrl/Cmd + P).
3. Destino: **Guardar como PDF**.
4. Ajusta márgenes y escala si lo deseas y guarda.

### Opción B – Desde la línea de comandos

Si tienes Node.js y quieres generar el PDF automáticamente:

```bash
npx md-to-pdf docs/CONTEXTO_PLATAFORMA.md --dest docs/CONTEXTO_PLATAFORMA.pdf
```

(Requiere instalar/ejecutar `md-to-pdf` la primera vez.)

### Opción C – Desde VS Code / Cursor

- Abre `CONTEXTO_PLATAFORMA.md` y usa una extensión tipo “Markdown PDF” para exportar a PDF desde el editor.

---

## 6. Referencia rápida de archivos

| Archivo | Contenido |
|--------|-----------|
| `README.md` | Instalación, scripts, variables de entorno, troubleshooting básico. |
| `docs/CONTEXTO_PLATAFORMA.md` | Este documento (contexto completo). |
| `docs/CONTEXTO_PLATAFORMA.html` | Misma información en HTML para imprimir/PDF. |
| `docs/SECURITY_ROADMAP.md` | Roadmap de seguridad detallado. |
| `docs/PROMPT_GPT_CREAR_PAQUETE_CASO_DE_USO.md` | Prompt para que un GPT genere JSON de caso de uso. |
| `server/use-case-package-format.md` | Formato técnico del package (entidades, records, workflow, simulation, dashboard). |
| `.cursor/rules/use-case-import-json.mdc` | Regla para generar JSON válido para Import Package. |

---

*Documento generado para uso interno y como contexto de la plataforma Intemic Structure Manager.*
