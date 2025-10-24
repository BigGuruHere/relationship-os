// scripts/safe-migrate-dev.js
// PURPOSE: prevent migrate dev from running against production by mistake
// SECURITY: checks APP_ORIGIN and NODE_ENV before calling prisma migrate dev

// Allowlist of non-prod origins
const okOrigins = new Set([
    'http://localhost:5173',
    'https://dev.relish.live'
  ]);
  
  const origin = process.env.APP_ORIGIN || '';
  const nodeEnv = process.env.NODE_ENV || '';
  
  if (!okOrigins.has(origin) || nodeEnv === 'production') {
    console.error('Refusing to run migrate dev - APP_ORIGIN or NODE_ENV looks like production');
    console.error(`APP_ORIGIN=${origin} NODE_ENV=${nodeEnv}`);
    process.exit(1);
  }
  
  const { spawn } = require('node:child_process');
  const child = spawn('npx', ['prisma', 'migrate', 'dev', ...process.argv.slice(2)], { stdio: 'inherit' });
  child.on('exit', code => process.exit(code ?? 1));
  