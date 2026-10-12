// PURPOSE: Resolve ElevenLabs telephony identity into one custody-local Relish participant.
// SECURITY: Resolution is fail-closed. Conflicting identifiers never silently choose a person.
import { prisma } from '$lib/db';
import { buildIndexToken, decrypt } from '$lib/crypto';
import { normalizePhoneForIdentity } from './phone.ts';
export { normalizePhoneForIdentity } from './phone.ts';

export type ConversationIdentityScope = { userId: string; contextSpaceId: string };

export type ElevenLabsIdentityHints = {
  relishContactId?: unknown;
  relishPersonId?: unknown;
  callerPhone?: unknown;
  providerUserId?: unknown;
};

export type ElevenLabsIdentityResolution = {
  status: 'RESOLVED' | 'UNRESOLVED' | 'CONFLICT';
  contactId: string | null;
  personId: string | null;
  callerPhone: string | null;
  method: string | null;
  matchedMethods: string[];
};

function clean(value: unknown, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : '';
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function candidatePhoneTokens(phone: string | null) {
  if (!phone) return [];
  const variants = new Set<string>([phone, phone.replace(/^\+/, '')]);
  if (phone.startsWith('+61')) variants.add(`0${phone.slice(3)}`);
  return [...variants].map(buildIndexToken);
}

export async function resolveElevenLabsIdentity(scope: ConversationIdentityScope, hints: ElevenLabsIdentityHints): Promise<ElevenLabsIdentityResolution> {
  const relishContactId = clean(hints.relishContactId);
  const relishPersonId = clean(hints.relishPersonId);
  const providerUserId = clean(hints.providerUserId);
  const callerPhone = normalizePhoneForIdentity(hints.callerPhone);
  const matches = new Map<string, { personId: string | null; methods: Set<string> }>();

  function add(contact: { id: string; personId: string | null } | null | undefined, method: string) {
    if (!contact) return;
    const prior = matches.get(contact.id) ?? { personId: contact.personId, methods: new Set<string>() };
    prior.methods.add(method);
    matches.set(contact.id, prior);
  }

  if (relishContactId) {
    add(await prisma.contact.findFirst({
      where: { id: relishContactId, userId: scope.userId, contextSpaceId: scope.contextSpaceId },
      select: { id: true, personId: true }
    }), 'RELISH_CONTACT_ID');
  }

  if (relishPersonId && looksLikeUuid(relishPersonId)) {
    add(await prisma.contact.findFirst({
      where: { personId: relishPersonId, userId: scope.userId, contextSpaceId: scope.contextSpaceId },
      select: { id: true, personId: true }
    }), 'RELISH_PERSON_ID');
  }

  // Provider user ids are useful when Relish deliberately supplied one of its own stable ids,
  // or when it corresponds to an already-linked Relish user. Arbitrary provider ids are retained
  // as encrypted conversation metadata but are not trusted as a person mapping by themselves.
  if (providerUserId) {
    const or: any[] = [{ linkedUserId: providerUserId }];
    if (looksLikeUuid(providerUserId)) or.push({ id: providerUserId }, { personId: providerUserId });
    const rows = await prisma.contact.findMany({
      where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, OR: or },
      select: { id: true, personId: true }, take: 3
    });
    for (const row of rows) add(row, 'ELEVENLABS_USER_ID');
  }

  if (callerPhone) {
    const tokens = candidatePhoneTokens(callerPhone);
    if (tokens.length) {
      const indexed = await prisma.contact.findMany({
        where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, phoneIdx: { in: tokens } },
        select: { id: true, personId: true }, take: 3
      });
      for (const row of indexed) add(row, 'PHONE_INDEX');
    }

    // Compatibility fallback for older contacts whose phoneIdx was built from formatted/local text.
    // This remains custody-local and bounded, and lets +61 caller ID match legacy 04xx numbers.
    if (![...matches.values()].some(match => match.methods.has('PHONE_INDEX'))) {
      const legacy = await prisma.contact.findMany({
        where: { userId: scope.userId, contextSpaceId: scope.contextSpaceId, phoneEnc: { not: null } },
        select: { id: true, personId: true, phoneEnc: true }, take: 500
      });
      for (const row of legacy) {
        try {
          const stored = normalizePhoneForIdentity(row.phoneEnc ? decrypt(row.phoneEnc, 'contact.phone') : '');
          if (stored && stored === callerPhone) add(row, 'PHONE_LEGACY_NORMALIZED');
        } catch {
          // A malformed historical phone value must not break call initiation.
        }
      }
    }
  }

  if (matches.size === 0) return { status: 'UNRESOLVED', contactId: null, personId: null, callerPhone, method: null, matchedMethods: [] };
  if (matches.size > 1) {
    return {
      status: 'CONFLICT', contactId: null, personId: null, callerPhone, method: null,
      matchedMethods: [...new Set([...matches.values()].flatMap(match => [...match.methods]))]
    };
  }
  const [contactId, match] = [...matches.entries()][0];
  const matchedMethods = [...match.methods];
  return {
    status: 'RESOLVED', contactId, personId: match.personId, callerPhone,
    method: matchedMethods.includes('RELISH_CONTACT_ID') ? 'RELISH_CONTACT_ID'
      : matchedMethods.includes('PHONE_INDEX') ? 'PHONE'
      : matchedMethods.includes('PHONE_LEGACY_NORMALIZED') ? 'PHONE'
      : matchedMethods.includes('RELISH_PERSON_ID') ? 'RELISH_PERSON_ID'
      : 'ELEVENLABS_USER_ID',
    matchedMethods
  };
}
