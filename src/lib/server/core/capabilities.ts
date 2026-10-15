// PURPOSE: Account privilege policy, separate from ContextSpace data custody.
// SECURITY: Default deny on missing grants; owner compatibility is explicit.
export type Capability = 'MEMBER' | 'OPERATOR' | 'ADMIN' | 'BROKER';
export type AccountRole = 'owner' | 'member' | 'guest';
const privileged: Capability[] = ['OPERATOR', 'ADMIN', 'BROKER'];

// IT: A legacy owner retains management access. Guest never inherits member rights.
export function effectiveCapabilities(role: AccountRole, grants: readonly string[] = []): Capability[] {
  if (role === 'guest') return [];
  if (role === 'owner') return ['MEMBER', ...privileged];
  const valid = grants.filter((value): value is Capability => privileged.includes(value as Capability));
  return ['MEMBER', ...new Set(valid)];
}

export function hasCapability(capabilities: readonly Capability[] | undefined, required: Capability): boolean {
  return !!capabilities?.includes(required);
}

// IT: Match complete path segments only; client supplied query strings never affect the policy.
export function requiredCapabilityForPath(pathname: string): Capability | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  const within = (prefix: string) => path === prefix || path.startsWith(prefix + '/');
  // SECURITY: Account management is owner-only in addition to the route capability gate.
  if (within('/settings/users') || within('/settings/context-spaces')) return 'ADMIN';
  if (within('/settings/agents')) return 'ADMIN';
  if (within('/general') && !within('/general/public')) return 'OPERATOR';
  if (['/leads', '/companies', '/deals', '/agents', '/workstreams', '/api/leads', '/api/task-commercial-links'].some(within)) return 'BROKER';
  return null;
}
