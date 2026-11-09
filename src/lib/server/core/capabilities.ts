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

function within(path: string, prefix: string) {
  return path === prefix || path.startsWith(prefix + '/');
}

const brokerCapabilityPaths = [
  '/broker', '/leads', '/companies', '/deals', '/agents', '/workstreams', '/api/leads',
  '/api/task-commercial-links'
];

// These legacy CRM screens mix contacts or tasks with commercial records.
// The private My People routes and contextual experiences have their own boundaries.
const retiredCrmPaths = [
  '/contacts', '/tasks', '/projects', '/search', '/actions', '/wants', '/offers',
  '/introductions', '/reminders', '/reconnect', '/api/guest/start', '/api/guest/claim-linkedin',
  '/guest/welcome', '/thank-you'
];

export function brokerageEnabled() {
  return process.env.RELISH_BROKERAGE_ENABLED === 'YES';
}

export function isBrokeragePath(route: string) {
  return [...brokerCapabilityPaths, ...retiredCrmPaths].some(prefix => within(route, prefix)) ||
    /^\/u\/[^/]+\/lead(?:\/|$)/.test(route);
}

// IT: Match complete path segments only; client supplied query strings never affect the policy.
export function requiredCapabilityForPath(pathname: string): Capability | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  // SECURITY: Account management is owner-only in addition to the route capability gate.
  if (['/settings/users', '/settings/context-spaces', '/settings/agents'].some(prefix => within(path, prefix))) return 'ADMIN';
  if (within(path, '/operator')) return 'OPERATOR';
  if (within(path, '/general') && !within(path, '/general/public')) return 'OPERATOR';
  if (brokerCapabilityPaths.some(prefix => within(path, prefix))) return 'BROKER';
  return null;
}
