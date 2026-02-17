# Runbook – Producción y seguridad

> Variables de entorno obligatorias, checklist pre-deploy y criterios de revisión de rutas.

## 1. Variables de entorno

### Obligatorias en producción

| Variable | Descripción | Cómo generar / valor |
|--------|-------------|----------------------|
| `NODE_ENV` | `production` en producción | `production` |
| `JWT_SECRET` | Secreto para firmar JWTs. **Nunca** usar el valor por defecto en producción. | Mín. 64 caracteres: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma). Evitar `*` en producción. | Ej: `https://app.tudominio.com,https://admin.tudominio.com` |
| `ENCRYPTION_KEY` | Clave para cifrado AES-256-GCM (campos sensibles). Requerida si se usa cifrado de campos. | 32 bytes en hex: `crypto.randomBytes(32).toString('hex')` |

### Recomendadas / funcionalidad

| Variable | Descripción | Por defecto / nota |
|--------|-------------|--------------------|
| `DATABASE_PATH` | Ruta del SQLite. | `./database.sqlite` |
| `PORT` | Puerto del API. | `3001` |
| `OPENAI_API_KEY` | OpenAI (informes, asistentes, etc.). | Sin valor = funcionalidad limitada |
| `APP_URL` | URL pública del frontend (emails, callbacks). | `http://localhost:5173` |
| `FRONTEND_URL` | Misma idea que APP_URL en algunos flujos. | |
| `RESEND_API_KEY` | Emails (verificación, notificaciones). | Sin valor = no se envían emails |
| `RESEND_FROM` | Remitente de Resend. | `Intemic <onboarding@resend.dev>` |
| `STRIPE_SECRET_KEY` | Pagos. | Placeholder en dev |
| `STRIPE_WEBHOOK_SECRET` | Webhooks de Stripe. | |
| `API_URL` | URL del API (usada por workers/integraciones). | `http://localhost:3001` |

### Opcionales (integraciones / seguridad avanzada)

- `SECRETS_PROVIDER`: `env` | `aws` | `vault`
- `LOG_LEVEL`, `LOG_FORMAT`
- `AI_RATE_LIMIT_PER_MIN`
- Claves de SSO, AWS, Prefect, etc. según documentación de cada módulo.

---

## 2. Checklist pre-deploy

- [ ] **Secrets**
  - [ ] `JWT_SECRET` definido y con al menos 64 caracteres aleatorios (no el valor por defecto).
  - [ ] `ENCRYPTION_KEY` definido si se usa cifrado de campos.
  - [ ] Rotar cualquier secreto que haya podido quedar expuesto (historial git, logs).
- [ ] **CORS**
  - [ ] `CORS_ORIGINS` configurado con los dominios reales (sin `*` en producción).
- [ ] **Base de datos**
  - [ ] Ejecutar migraciones: `npm run migrate-tables` (crea tablas faltantes si aplica).
  - [ ] Backup de la BD antes de cambios de esquema.
- [ ] **App**
  - [ ] `NODE_ENV=production`.
  - [ ] `APP_URL` / `FRONTEND_URL` apuntando a la URL pública del frontend.
- [ ] **Post-deploy**
  - [ ] Probar login y una operación por recurso (entidad, workflow, etc.).
  - [ ] Revisar logs (sin volcar secrets).

Referencia de seguridad detallada: `docs/SECURITY_ROADMAP.md`.

---

## 3. Revisión de rutas (autenticación y multi-tenant)

Criterios que debe cumplir cualquier ruta que toque datos sensibles:

1. **Autenticación**: usar el middleware `authenticateToken` (o equivalente) en todas las rutas que devuelven o modifican datos por usuario/organización.
2. **Multi-tenant**: todas las consultas que lean o escriban datos por organización deben filtrar por `organizationId` / `req.user.orgId` (nunca devolver datos de otra organización).
3. **RBAC** (donde aplique): en operaciones administrativas o sensibles, usar `requirePermission` o `requireOrgAdmin` según `server/security/rbac.js`.

### Estado actual (referencia)

- **`/api/entities`**, **`/api/knowledge/*`**, **`/api/data-connections`**, **`/api/standards`**, **`/api/dashboards`**, **`/api/ai/*`**: usan `authenticateToken` y filtran por `organizationId`/`req.user.orgId` en las consultas.
- **`/api/workflows`**: rutas de CRUD, execute, executions, pending-approvals usan `authenticateToken`; webhook y `run-public` son intencionalmente públicas.
- **Auth**: rutas públicas de login/register; el resto de `/api/auth/*` y `/api/profile` con `authenticateToken` donde corresponda.
- **Archivos**: `POST /upload`, `POST /parse-spreadsheet`, `GET /files/:filename/content` usan `authenticateToken`. **`GET /files/:filename`** y **`GET /files/:filename/download`** no requieren auth (cualquiera con el nombre puede acceder); valorar token en query o middleware si los ficheros son sensibles.
- **Properties** (`/api/properties`): usan `authenticateToken` pero no comprueban que `entityId` pertenezca a `req.user.orgId`; las propiedades están ligadas a entidades que sí están por org. Recomendación: en POST/PUT/DELETE validar que la entidad asociada sea de la misma organización.

Ante nuevas rutas o cambios en rutas existentes, comprobar que se mantienen estos tres puntos (auth + orgId + RBAC si aplica).
