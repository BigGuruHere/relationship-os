// Stage 8.17 - Present one Relish identity through deliberately separate relationship contexts.
// SECURITY: This file chooses UI availability only. Data queries still require server-side owner
// and ContextSpace scoping, and workspace routes re-check the allowed context on every request.
import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/db';

export const WORKSPACE_CONFIG = {
  business: { domain: 'business', kind: 'business', label: 'Business', color: '#3276b8', description: 'Professional relationships and connections' },
  friendship: { domain: 'general', kind: 'personal', label: 'Friendship', color: '#16877c', description: 'Friendships and social connections' },
  dating: { domain: 'dating', kind: 'dating', label: 'Dating', color: '#a34b86', description: 'Personal and romantic connections' }
} as const;
export type WorkspaceName = keyof typeof WORKSPACE_CONFIG;
export const WORKSPACE_NAMES = Object.keys(WORKSPACE_CONFIG) as WorkspaceName[];

export function workspaceFromDomain(domain: string): WorkspaceName {
  return domain === 'dating' ? 'dating' : domain === 'general' ? 'friendship' : 'business';
}

export function workspaceName(value: string): WorkspaceName | null {
  return Object.prototype.hasOwnProperty.call(WORKSPACE_CONFIG, value) ? value as WorkspaceName : null;
}

export async function visibleRelishWorkspaces(userId: string, role: string) {
  // IT: Owners can switch between the three product contexts, even before setting them up.
  if (role === 'owner') {
    const owned = await prisma.contextSpace.findMany({
      where: { ownerUserId: userId, domainKey: { in: ['business', 'general', 'dating'] } },
      select: { domainKey: true }
    });
    return WORKSPACE_NAMES.map(name => ({ name, ...WORKSPACE_CONFIG[name], configured: owned.some(s => s.domainKey === WORKSPACE_CONFIG[name].domain) }));
  }

  // IT: During the limited pilot, a member sees only the first QR relationship context.
  // This does not merge unrelated contexts or grant them access to other scopes.
  const firstEntry = await prisma.pilotProfileEntry.findFirst({
    where: { visitorUserId: userId }, orderBy: { createdAt: 'asc' },
    select: { domainKey: true }
  });
  const owned = await prisma.contextSpace.findMany({
    where: { ownerUserId: userId, domainKey: { in: ['business', 'general', 'dating'] } },
    select: { domainKey: true, createdAt: true }, orderBy: { createdAt: 'asc' }
  });
  const initialDomain = firstEntry?.domainKey || owned[0]?.domainKey;
  const selected = WORKSPACE_NAMES.find(name => WORKSPACE_CONFIG[name].domain === initialDomain);
  if (!selected || !owned.some(s => s.domainKey === WORKSPACE_CONFIG[selected].domain)) return [];
  return [{ name: selected, ...WORKSPACE_CONFIG[selected], configured: true }];
}

export async function requireRelishWorkspace(locals: App.Locals, name: string) {
  if (!locals.user) throw redirect(303, '/auth/login');
  const selected = workspaceName(name);
  if (!selected) throw error(404, 'Unknown Relish context.');
  const available = await visibleRelishWorkspaces(locals.user.id, locals.user.role || 'member');
  if (!available.some(s => s.name === selected)) throw error(403, 'This context is not available to this participant.');
  // SECURITY: The actual context is selected by the server-side route domain resolver.
  if (locals.contextDomainKey !== WORKSPACE_CONFIG[selected].domain) throw error(403, 'Context route mismatch.');
  if (locals.contextSpaceId) {
    const matching = await prisma.contextSpace.findFirst({
      where: { id: locals.contextSpaceId, ownerUserId: locals.user.id, domainKey: WORKSPACE_CONFIG[selected].domain },
      select: { id: true }
    });
    if (!matching) throw error(403, 'Context custody mismatch.');
  }
  return { name: selected, ...WORKSPACE_CONFIG[selected], configured: Boolean(locals.contextSpaceId) };
}
