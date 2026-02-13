/**
 * Startup secret validation
 * Ensures all required secrets are configured before the server starts.
 * In production, missing critical secrets will prevent startup.
 */

const REQUIRED_SECRETS = [
  { key: 'JWT_SECRET', description: 'JWT signing key', critical: true },
  { key: 'OPENAI_API_KEY', description: 'OpenAI API key for AI features', critical: false },
];

const RECOMMENDED_SECRETS = [
  { key: 'RESEND_API_KEY', description: 'Resend email service' },
  { key: 'STRIPE_SECRET_KEY', description: 'Stripe payment processing' },
  { key: 'AWS_ACCESS_KEY_ID', description: 'AWS services access' },
  { key: 'AWS_SECRET_ACCESS_KEY', description: 'AWS services secret' },
];

// Secrets that must NEVER appear in logs
const REDACTED_KEYS = [
  'JWT_SECRET', 'OPENAI_API_KEY', 'RESEND_API_KEY', 'STRIPE_SECRET_KEY',
  'AWS_SECRET_ACCESS_KEY', 'GOOGLE_API_KEY', 'PREFECT_API_KEY',
  'GCS_BUCKET_NAME', 'AWS_ACCESS_KEY_ID',
];

function validateSecrets() {
  const IS_PRODUCTION = process.env.NODE_ENV === 'production';
  const errors = [];
  const warnings = [];

  console.log('[Security] Validating environment secrets...');

  // Check required secrets
  for (const secret of REQUIRED_SECRETS) {
    const value = process.env[secret.key];
    if (!value || value.trim() === '') {
      if (secret.critical && IS_PRODUCTION) {
        errors.push(`CRITICAL: ${secret.key} is not set (${secret.description})`);
      } else if (secret.critical) {
        warnings.push(`${secret.key} is not set - using insecure default (${secret.description})`);
      }
    } else {
      // Check for obviously insecure values
      const insecureValues = ['your-secret-key-change-in-production', 'changeme', 'secret', 'password', '123456'];
      if (insecureValues.includes(value.toLowerCase()) && IS_PRODUCTION) {
        errors.push(`CRITICAL: ${secret.key} has an insecure default value`);
      }
    }
  }

  // Check recommended secrets (warnings only)
  for (const secret of RECOMMENDED_SECRETS) {
    const value = process.env[secret.key];
    if (!value || value.trim() === '') {
      warnings.push(`${secret.key} is not configured - ${secret.description} will be unavailable`);
    }
  }

  // Print results
  if (warnings.length > 0) {
    console.warn('[Security] Warnings:');
    warnings.forEach(w => console.warn(`  ⚠ ${w}`));
  }

  if (errors.length > 0) {
    console.error('[Security] FATAL ERRORS:');
    errors.forEach(e => console.error(`  ✖ ${e}`));
    if (IS_PRODUCTION) {
      console.error('[Security] Server cannot start with missing critical secrets in production.');
      console.error('[Security] Set all required environment variables and restart.');
      process.exit(1);
    }
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('[Security] All secrets validated ✓');
  }

  return { errors, warnings };
}

/**
 * Redact sensitive values from a string (for logging)
 */
function redactSecrets(str) {
  let redacted = str;
  for (const key of REDACTED_KEYS) {
    const value = process.env[key];
    if (value && value.length > 4) {
      redacted = redacted.replace(new RegExp(escapeRegex(value), 'g'), `[REDACTED:${key}]`);
    }
  }
  return redacted;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { validateSecrets, redactSecrets, REDACTED_KEYS };
