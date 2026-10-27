// Stage 8.17 - Context-scoped data for the simple relationship workspace.
// SECURITY: Neither broker CRM contacts nor private Living Understanding are returned here.
import { prisma } from '$lib/db';
import { decrypt } from '$lib/crypto';
import { WORKSPACE_CONFIG, type WorkspaceName } from './relishWorkspace';

export async function loadContextProfile(ownerUserId: string, name: WorkspaceName) {
  return prisma.profile.findFirst({
    where: { userId: ownerUserId, kind: WORKSPACE_CONFIG[name].kind },
    select: { id: true, slug: true, displayName: true, headline: true, avatarUrl: true, isPublished: true, qrSvg: true },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
  });
}

export async function loadContextPeople(ownerUserId: string, name: WorkspaceName) {
  const domainKey = WORKSPACE_CONFIG[name].domain;
  // Only connection requests directed to the signed-in owner are visible.
  const requests = await prisma.pilotConnectionRequest.findMany({
    where: { ownerUserId, domainKey },
    orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, nameEnc: true, emailEnc: true, createdAt: true, status: true }
  });
  const people = requests.map(row => ({
    id: row.id, name: decrypt(row.nameEnc, 'pilot.connection.name'),
    email: decrypt(row.emailEnc, 'pilot.connection.email'),
    status: row.status, since: row.createdAt.toISOString(), kind: 'request' as const,
    profileSlug: null as string | null
  }));
  // Show a participant the profile owners they explicitly asked to connect with.
  // Opening a QR or talking to Dorian alone is NOT a connection request.
  const sent = await prisma.pilotConnectionRequest.findMany({
    where: { visitorUserId: ownerUserId, domainKey },
    select: { id: true, profileId: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 100
  });
  const sentProfiles = sent.length ? await prisma.profile.findMany({
    where: { id: { in: sent.map(row => row.profileId) }, isPublished: true },
    select: { id: true, slug: true, displayName: true }
  }) : [];
  const profileById = new Map(sentProfiles.map(row => [row.id, row]));
  for (const row of sent) {
    const profile = profileById.get(row.profileId);
    if (!profile) continue;
    people.push({ id: row.id, name: profile.displayName || 'Your connection',
      email: '', status: row.status === 'REQUESTED' ? 'SENT' : row.status,
      since: row.createdAt.toISOString(), kind: 'request' as const, profileSlug: profile.slug });
  }
  if (name !== 'friendship') return people;

  // Reuse established reciprocal Network connections only inside Friendship.
  const origins = await prisma.networkConnectionOrigin.findMany({
    where: { OR: [{ inviterUserId: ownerUserId }, { visitorUserId: ownerUserId }] },
    select: { inviterUserId: true, visitorUserId: true, createdAt: true },
    orderBy: { createdAt: 'desc' }, take: 100
  });
  const otherUsers = new Map<string, Date>();
  for (const origin of origins) {
    const other = origin.inviterUserId === ownerUserId ? origin.visitorUserId : origin.inviterUserId;
    if (other !== ownerUserId && !otherUsers.has(other)) otherUsers.set(other, origin.createdAt);
  }
  if (!otherUsers.size) return people;
  const [hidden, profiles] = await Promise.all([
    prisma.networkConnectionVisibility.findMany({
      where: { userId: ownerUserId, otherUserId: { in: [...otherUsers.keys()] } }, select: { otherUserId: true }
    }),
    prisma.profile.findMany({
      where: { userId: { in: [...otherUsers.keys()] }, kind: 'personal', isPublished: true },
      select: { userId: true, slug: true, displayName: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    })
  ]);
  const hiddenIds = new Set(hidden.map(h => h.otherUserId));
  const preferredProfiles = new Map<string, (typeof profiles)[number]>();
  for (const profile of profiles) if (!preferredProfiles.has(profile.userId)) preferredProfiles.set(profile.userId, profile);
  return [
    ...[...otherUsers.entries()].filter(([id]) => !hiddenIds.has(id)).map(([id, since]) => ({
      id, name: preferredProfiles.get(id)?.displayName || 'Network member', email: '',
      status: 'CONNECTED', since: since.toISOString(), kind: 'connection' as const,
      profileSlug: preferredProfiles.get(id)?.slug || null
    })),
    ...people
  ];
}
