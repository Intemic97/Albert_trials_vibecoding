# Security Roadmap - Enterprise Readiness

> Roadmap de seguridad en 4 fases para que el producto sea adoptable por empresas como Damm o Repsol.
> Last updated: 2026-02-13

## Current State

The product has a reasonable security baseline: JWT auth with HTTP-only cookies, bcrypt passwords, rate limiting, audit logs, multi-tenancy via orgId, and parameterized SQLite queries.

### What has been implemented (Phase 0 + Phase 1 + Phase 2)

| Feature | Status | Location |
|---------|--------|----------|
| JWT secret validation (no hardcoded fallback) | Done | `server/auth.js` |
| SQL injection protection (MySQL endpoint + Prefect) | Done | `server/index.js`, `node_handlers.py` |
| Helmet.js + CSP + HSTS headers | Done | `server/index.js` |
| Strong password policy (8 chars, complexity) | Done | `server/auth.js` |
| Email verification bypass removed | Done | `server/auth.js` |
| Startup secret validation | Done | `server/security/validateSecrets.js` |
| CORS configurable via env var | Done | `server/index.js` |
| SSO module (SAML 2.0 + OIDC) | Done | `server/security/sso.js` |
| Field-level AES-256-GCM encryption | Done | `server/security/encryption.js` |
| Secrets manager abstraction (env/AWS/Vault) | Done | `server/security/secretsManager.js` |
| RBAC (Admin, Editor, Viewer, Auditor) | Done | `server/security/rbac.js` |
| GDPR: right to be forgotten | Done | `server/security/gdpr.js` |
| GDPR: data export (portability) | Done | `server/security/gdpr.js` |
| GDPR: consent management | Done | `server/security/gdpr.js` |
| CI/CD security pipeline | Done | `.github/workflows/security.yml` |
| DB tables: sso_configurations, role_permissions, data_deletion_requests, user_consents | Done | `server/db.js` |

### What still needs operational work

- **Rotate all exposed secrets** - API keys were in git history. Must rotate: OpenAI, Stripe, AWS, Resend, Prefect keys
- **Configure CORS_ORIGINS** in production `.env` with actual domain(s)
- **Set strong JWT_SECRET** in production (min 64 chars, `crypto.randomBytes(64).toString('hex')`)
- **Set ENCRYPTION_KEY** in production for field-level encryption
- **Enable SSO** for each enterprise client (configure their IdP in the SSO settings)

---

## Phase 0: Critical / Immediate (Week 1-2) - DONE

- Remove hardcoded JWT secret fallback, enforce env var in production
- Fix SQL injection in MySQL query endpoint and Prefect worker
- Install Helmet.js with CSP, HSTS, security headers
- Strengthen password policy (8 chars, uppercase, lowercase, number, special)
- Remove email verification bypass
- Add startup secret validation
- Clean debug logs that exposed API key values
- Make CORS configurable via env var

**Key files**: `server/auth.js`, `server/index.js`, `server/security/validateSecrets.js`

---

## Phase 1: Enterprise Foundation (Month 1-2) - DONE

### 1.1 Enterprise Authentication (SSO)

- SAML 2.0 and OpenID Connect support
- Auto-create users from SSO login
- Per-organization SSO configuration
- Routes: `/api/sso/saml/login/:orgId`, `/api/sso/oidc/login/:orgId`, `/api/sso/config`

### 1.2 Encryption

- Field-level AES-256-GCM encryption for sensitive data
- Encryption module at `server/security/encryption.js`
- Functions: `encrypt()`, `decrypt()`, `encryptFields()`, `decryptFields()`

### 1.3 Secrets Management

- Abstraction layer supporting env vars, AWS Secrets Manager, HashiCorp Vault
- Configurable via `SECRETS_PROVIDER` env var
- Built-in caching with TTL
- Module at `server/security/secretsManager.js`

### 1.4 Granular Access Control (RBAC)

- 4 roles: Admin, Editor, Viewer, Auditor
- Permission matrix per resource (entities, workflows, dashboards, etc.)
- Middleware: `requirePermission('resource', 'action')`
- Routes: `/api/rbac/roles`, `/api/rbac/my-permissions`, `/api/rbac/users/:userId/role`

---

## Phase 2: Compliance & Certification (Month 3-6) - STARTED

### 2.1 GDPR / LOPD - DONE

- Right to be forgotten: `/api/gdpr/deletion-request`
- Data export: `/api/gdpr/export`
- Consent management: `/api/gdpr/consent`
- Audit trail for all GDPR actions
- DB tables: `data_deletion_requests`, `user_consents`

### 2.2 CI/CD Security Pipeline - DONE

- `npm audit` on every build
- Secret scanning in git history
- Security configuration verification (Helmet, JWT, password policy, email bypass)
- Runs on push to main, PRs, and weekly schedule

### 2.3 SOC 2 Type II - TODO

- SLAs, backups, disaster recovery plan
- Centralized logging
- Change management documentation
- Annual penetration testing

### 2.4 ISO 27001 - TODO

- Security policy documentation
- Formal risk management
- Business continuity plan (BCP)
- Incident management procedures

---

## Phase 3: Hardening & Monitoring (Month 6-9) - TODO

- SAST with Semgrep or SonarQube
- Dependency scanning with Dependabot/Snyk
- SIEM integration (Datadog, Splunk, CloudWatch)
- Docker hardening (minimal base, non-root, read-only)
- WAF (Cloudflare, AWS WAF)
- DDoS protection
- Encrypted backups with restoration testing
- Annual external penetration test

---

## Phase 4: Enterprise-Ready (Month 9-12) - TODO

- Single tenant / dedicated deployment option
- VPC peering, on-premise (Docker/K8s)
- Data Loss Prevention (classification, exfiltration policies)
- IP whitelisting, VPN integration, mTLS
- Security whitepaper, compliance questionnaires (CAIQ, SIG)

---

## Enterprise-Specific Requirements

- **Damm** (food/beverage): Data traceability (lots, processes), GDPR, full audit trail for food safety regulators
- **Repsol** (energy/industrial): OT security (plant data), strict data segregation between divisions, possible on-premise for refinery data, NIS2 compliance

Both would require minimum: **SSO + SOC 2 + GDPR + Pentest + DPA** before signing.

---

## Security Module Architecture

```
server/security/
  validateSecrets.js    - Startup secret validation, redaction
  sso.js                - SAML 2.0 + OIDC SSO integration
  encryption.js         - AES-256-GCM field-level encryption
  secretsManager.js     - Secrets provider abstraction (env/AWS/Vault)
  rbac.js               - Role-based access control with 4 roles
  gdpr.js               - GDPR compliance (deletion, export, consent)
```
