// PURPOSE: Read explicit deployment configuration without implicit development defaults.
// SECURITY: Error messages name keys only, never log the credential or its value.
// Call at feature boundaries; disabled optional features do not require unused credentials.
export function requiredEnv(name: string, minLength = 1): string {
  const raw = process.env[name];
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error(`[Relish config] Missing required environment variable: ${name}`);
  }
  if (raw.length < minLength) {
    throw new Error(`[Relish config] ${name} must contain at least ${minLength} characters`);
  }
  return raw;
}

export function requiredPositiveIntEnv(name: string): number {
  const raw = requiredEnv(name).trim();
  if (!/^[1-9]\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    throw new Error(`[Relish config] ${name} must be a positive integer`);
  }
  return Number(raw);
}

export function requiredYesNoEnv(name: string): boolean {
  const raw = requiredEnv(name).trim().toUpperCase();
  if (raw === 'YES') return true;
  if (raw === 'NO') return false;
  throw new Error(`[Relish config] ${name} must be YES or NO`);
}
