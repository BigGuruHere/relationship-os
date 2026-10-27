// Stage 8.19 config hardening: reject missing/invalid deployment requirements before app startup.
// Does not print secret values. Optional providers are validated at their feature boundary.
export function validateRequiredEnvironment(env = process.env) {
  // Explicitly read from the supplied environment, for testability.
  const missing = [];
  const invalid = [];
  const need = (name, min = 1) => {
    const value = env[name];
    if (typeof value !== 'string' || !value.trim()) missing.push(name);
    else if (value.length < min) invalid.push(`${name} must have at least ${min} characters`);
  };
  const positiveInteger = (name) => {
    need(name);
    if (env[name] && (!/^[1-9]\d*$/.test(env[name].trim()) || !Number.isSafeInteger(Number(env[name])))) {
      invalid.push(`${name} must be a positive integer`);
    }
  };
  const yesNo = (name) => {
    need(name);
    if (env[name] && !['YES', 'NO'].includes(env[name].trim().toUpperCase())) {
      invalid.push(`${name} must be YES or NO`);
    }
  };
  const httpsUrl = (name) => {
    need(name);
    if (env[name]) {
      try { if (new URL(env[name]).protocol !== 'https:') invalid.push(`${name} must use HTTPS`); }
      catch { invalid.push(`${name} must be a valid HTTPS URL`); }
    }
  };

  // Required everywhere: missing signing/encryption/database material is never auto-generated.
  need('DATABASE_URL');
  need('SECRET_MASTER_KEY');
  if (env.SECRET_MASTER_KEY && !/^[0-9a-f]{64}$/i.test(env.SECRET_MASTER_KEY)) invalid.push('SECRET_MASTER_KEY must be 64 hex characters');
  need('SESSION_COOKIE_SECRET', 24);
  positiveInteger('SESSION_DAYS');
  need('LOGIN_THROTTLE_SECRET', 24);
  need('APP_ORIGIN');
  if (env.APP_ORIGIN) {
    try { if (!['http:', 'https:'].includes(new URL(env.APP_ORIGIN).protocol)) invalid.push('APP_ORIGIN must use HTTP(S)'); }
    catch { invalid.push('APP_ORIGIN must be a valid absolute URL'); }
  }
  if (env.DB_KEEPALIVE_ENABLED === 'YES' && env.DB_KEEPALIVE_DISABLED !== 'YES') positiveInteger('DB_KEEPALIVE_MINUTES');
  // Only enabled telephone onboarding requires every telephony/provider setting.
  const smsEnabled = env.RELISH_PILOT_SMS_CALLBACK_ENABLED === 'YES';
  const voiceTermsEnabled = env.RELISH_PILOT_CONVERSATIONAL_TERMS === 'YES';
  if (smsEnabled || voiceTermsEnabled) {
    if (!smsEnabled || !voiceTermsEnabled) invalid.push('RELISH_PILOT_SMS_CALLBACK_ENABLED and RELISH_PILOT_CONVERSATIONAL_TERMS must both be YES');
    for (const name of ['ELEVENLABS_INITIATION_SECRET', 'ELEVENLABS_POST_CALL_WEBHOOK_SECRET',
      'ELEVENLABS_API_KEY', 'ELEVENLABS_OUTBOUND_PHONE_NUMBER_ID',
      'TELNYX_API_KEY', 'TELNYX_PUBLIC_KEY', 'RELISH_NETWORK_DORIAN_BINDING_ID',
      'RELISH_DORIAN_SMS_NUMBER', 'RELISH_PILOT_TERMS_VERSION', 'TELEPHONY_DEFAULT_COUNTRY']) need(name);
    need('ELEVENLABS_TOOL_SECRET', 24);
    positiveInteger('ELEVENLABS_WEBHOOK_MAX_AGE_SECONDS');
    // Explicit, bounded SMS invitation lifetime. No hardcoded 20-minute fallback.
    positiveInteger('RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES');
    if (env.RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES &&
        Number(env.RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES) > 1440) {
      invalid.push('RELISH_PILOT_SMS_CODE_EXPIRY_MINUTES must be between 1 and 1440 minutes');
    }
    yesNo('LU_AUTO_PREPARE_AFTER_INGEST');
    // The same checked-in legal documents are served on each environment's host.
    // One public origin is used for the web app and checked-in legal documents.
    // Telephone onboarding requires the same APP_ORIGIN to be public HTTPS, with
    // no path/query/credentials, so all legal links remain unambiguous.
    httpsUrl('APP_ORIGIN');
    if (env.APP_ORIGIN) {
      try {
        const origin = new URL(env.APP_ORIGIN);
        if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
          invalid.push('APP_ORIGIN must be a public HTTPS origin (no path, query, credentials or fragment)');
        }
      } catch { /* httpsUrl() has already reported the invalid URL. */ }
    }
    if (env.HOSTING_URL !== undefined) {
      invalid.push('Remove HOSTING_URL: use APP_ORIGIN as the only public base URL');
    }
    if (env.RELISH_PILOT_TERMS_URL || env.RELISH_PILOT_PRIVACY_URL) {
      invalid.push('Remove RELISH_PILOT_TERMS_URL and RELISH_PILOT_PRIVACY_URL: all legal links now derive from APP_ORIGIN');
    }
    need('RELISH_LEGAL_DOCUMENTS_PUBLISHED');
    if (env.RELISH_LEGAL_DOCUMENTS_PUBLISHED !== 'YES') {
      invalid.push('RELISH_LEGAL_DOCUMENTS_PUBLISHED must be YES after reviewing and publishing the legal documents');
    }
    if (env.RELISH_DORIAN_SMS_NUMBER && !/^\+[1-9]\d{7,14}$/.test(env.RELISH_DORIAN_SMS_NUMBER)) {
      invalid.push('RELISH_DORIAN_SMS_NUMBER must be in E.164 format');
    }
    if (env.RELISH_PILOT_TERMS_VERSION && !/^[\w.-]{1,60}$/.test(env.RELISH_PILOT_TERMS_VERSION)) {
      invalid.push('RELISH_PILOT_TERMS_VERSION has an invalid format');
    }
  }
  if (missing.length || invalid.length) {
    throw new Error('[Relish startup configuration] ' + [
      missing.length ? `Missing: ${[...new Set(missing)].join(', ')}` : '',
      invalid.length ? `Invalid: ${[...new Set(invalid)].join('; ')}` : ''
    ].filter(Boolean).join(' | '));
  }
}

// Can run independently as `node scripts/validate-required-env.mjs`.
if (process.argv[1]?.endsWith('validate-required-env.mjs')) {
  try { validateRequiredEnvironment(); console.log('[Relish config] Startup configuration OK'); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
