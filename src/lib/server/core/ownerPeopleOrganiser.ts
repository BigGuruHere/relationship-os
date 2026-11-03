// Owner-only pilot classification for displaying legacy Business Contacts in My People.
// SECURITY: This tag affects directory visibility only. It never moves Contact custody,
// grants cross-context access, or makes its notes available in another ContextSpace.
import { prisma } from '$lib/db';
import { privateContactDetails } from './contacts';
import { runWithWorkspaceCustody } from './contextSpace';

export const OWNER_PERSONAL_TAG_SLUG = 'relish-my-people-personal';
const OWNER_PERSONAL_TAG_NAME = 'Relish My People - Personal';

type BusinessContact = ReturnType<typeof privateContactDetails> & {
  contextSpaceId: string;
  createdAt: Date;
  personal: boolean;
  origin: 'Business';
  href: string;
};

async function ownedBusinessSpaces(userId: string) {
  // SECURITY: The authenticated account is the authority for the set of spaces.
  return prisma.contextSpace.findMany({
    where: { ownerUserId: userId, domainKey: 'business', kind: 'WORKSPACE' },
    select: { id: true },
    orderBy: { createdAt: 'asc' }
  });
}

export async function listOwnerBusinessContacts(userId: string, personalOnly = false): Promise<BusinessContact[]> {
  const spaces = await ownedBusinessSpaces(userId);
  const all: BusinessContact[] = [];

  // IT: Enter each owned space explicitly; ordinary Prisma reads are intentionally scoped to
  // the current route's private ContextSpace and must not be broadened globally.
  for (const space of spaces) {
    const contacts = await runWithWorkspaceCustody({ userId, contextSpaceId: space.id }, () =>
      prisma.contact.findMany({
        where: {
          userId,
          contextSpaceId: space.id,
          ...(personalOnly ? {
            tags: { some: { tag: { slug: OWNER_PERSONAL_TAG_SLUG, userId, contextSpaceId: space.id } } }
          } : {})
        },
        select: {
          id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true,
          createdAt: true,
          tags: {
            where: { tag: { slug: OWNER_PERSONAL_TAG_SLUG, userId, contextSpaceId: space.id } },
            select: { tagId: true }
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]
      })
    );
    for (const contact of contacts) {
      all.push({
        ...privateContactDetails(contact),
        contextSpaceId: space.id,
        createdAt: contact.createdAt,
        personal: contact.tags.length > 0,
        origin: 'Business',
        // IT: The legacy detail screen continues to own Brokerage editing and history.
        href: '/contacts/' + contact.id
      });
    }
  }
  return all;
}

export async function setOwnerBusinessContactPersonal(
  userId: string,
  contextSpaceId: string,
  contactId: string,
  personal: boolean
) {
  // SECURITY: Never trust owner/context/contact identifiers supplied by a browser form.
  const space = await prisma.contextSpace.findFirst({
    where: { id: contextSpaceId, ownerUserId: userId, domainKey: 'business', kind: 'WORKSPACE' },
    select: { id: true }
  });
  if (!space) return false;

  return runWithWorkspaceCustody({ userId, contextSpaceId: space.id }, async () => {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, userId, contextSpaceId: space.id },
      select: { id: true }
    });
    if (!contact) return false;

    if (personal) {
      // IT: Use the existing ContextSpace-local Tag and ContactTag models. Concurrent
      // submissions are idempotent; optional tag embeddings are not needed for this flag.
      await prisma.tag.createMany({
        data: [{
          userId, contextSpaceId: space.id, slug: OWNER_PERSONAL_TAG_SLUG,
          name: OWNER_PERSONAL_TAG_NAME, createdBy: 'user'
        }],
        skipDuplicates: true
      });
    }

    const tag = await prisma.tag.findFirst({
      where: { userId, contextSpaceId: space.id, slug: OWNER_PERSONAL_TAG_SLUG },
      select: { id: true }
    });

    if (personal) {
      if (!tag) throw new Error('Personal classification tag could not be created.');
      await prisma.contactTag.createMany({
        data: [{ contactId, tagId: tag.id, assignedBy: 'user' }],
        skipDuplicates: true
      });
    } else if (tag) {
      // SECURITY: Delete only this specific classification link, not the Contact or
      // other tags, interactions, opportunities or relationship records.
      await prisma.contactTag.deleteMany({
        where: { contactId, tagId: tag.id }
      });
    }
    return true;
  });
}
