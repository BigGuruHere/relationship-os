// src/routes/search/+page.server.ts
// PURPOSE: Perform scoped search across Contacts - Notes - Tags. Supports an "All" scope.
// MULTI TENANT: Every query filters by userId.
// SECURITY: Decrypt only on the server. Never log decrypted PII.
// VECTORS: Use pgvector cosine distance with ::vector casts. Never execute with an empty vector.

import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt, buildIndexToken } from '$lib/crypto';
import * as Emb from '$lib/embeddings';

type Scope = 'all' | 'contacts' | 'notes' | 'tags';
const LIMIT = 20; // keep UI snappy

// IT: resolve an embedding helper without tying you to one function name
function resolveEmbedHelper() {
  const fn =
    (Emb as any).embedQuery ||
    (Emb as any).embedText ||
    (Emb as any).getEmbeddingForSearch ||
    (Emb as any).getEmbedding;
  if (typeof fn === 'function') return fn as (text: string) => Promise<number[]>;
  return async (_text: string) => {
    throw new Error('No embedding helper found in $lib/embeddings');
  };
}

// IT: convert numeric array to a Postgres vector literal, e.g. [0.1,-0.2] -> "[0.1,-0.2]"
function toVectorLiteral(vec: number[]) {
  return `[${vec.join(',')}]`;
}

export const load: PageServerLoad = async ({ url, locals }) => {
  // Require login
  if (!locals.user) {
    return { q: '', scope: 'all', results: { contacts: [], notes: [], tags: [] } };
  }

  const q = (url.searchParams.get('q') || '').trim();
  const scope = ((url.searchParams.get('scope') || 'all') as Scope);

  if (!q) {
    return { q: '', scope, results: { contacts: [], notes: [], tags: [] } };
  }

  const doContacts = scope === 'all' || scope === 'contacts';
  const doNotes = scope === 'all' || scope === 'notes';
  const doTags = scope === 'all' || scope === 'tags';

  const contacts: Array<{
    id: string; name: string; email: string; phone: string; company: string; tags: { name: string }[];
  }> = [];
  const notes: Array<{ id: string; contactId: string; contactName: string; occurredAt: Date; preview: string; }> = [];
  const tags: Array<{ id: string; name: string; contactCount: number; }> = [];

  // CONTACTS - exact matches via deterministic indexes and tag name matches
  if (doContacts) {
    const token = buildIndexToken(q);

    const exactRows = await prisma.contact.findMany({
      where: { userId: locals.user.id, OR: [{ emailIdx: token }, { phoneIdx: token }, { fullNameIdx: token }] },
      select: {
        id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, companyEnc: true,
        tags: { select: { tag: { select: { name: true } } }, take: 12 }
      },
      take: LIMIT
    });

    const tagRows = await prisma.contact.findMany({
      where: {
        userId: locals.user.id,
        tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } }
      },
      select: {
        id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, companyEnc: true,
        tags: { select: { tag: { select: { name: true } } }, take: 12 }
      },
      take: LIMIT
    });

    const rows = [...exactRows, ...tagRows];
    const seen = new Set<string>();
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);

      // Decrypt minimal display fields on server
      let name = '(name unavailable)';
      let email: string | null = null;
      let phone: string | null = null;
      let company: string | null = null;
      try { name = decrypt(r.fullNameEnc, 'contact.full_name'); } catch {}
      try { email = r.emailEnc ? decrypt(r.emailEnc, 'contact.email') : null; } catch {}
      try { phone = r.phoneEnc ? decrypt(r.phoneEnc, 'contact.phone') : null; } catch {}
      try { company = r.companyEnc ? decrypt(r.companyEnc, 'contact.company') : null; } catch {}

      contacts.push({
        id: r.id,
        name,
        email: email || '',
        phone: phone || '',
        company: company || '',
        tags: r.tags.map((ct) => ({ name: ct.tag.name }))
      });

      if (contacts.length >= LIMIT) break;
    }
  }

  // TAGS - simple ILIKE over Tag and TagAlias
// TAGS - ILIKE over Tag.name and TagAlias.alias
if (doTags) {
  const tagRows = await prisma.tag.findMany({
    where: {
      userId: locals.user.id,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { aliases: { some: { alias: { contains: q, mode: 'insensitive' } } } } // use alias here
      ]
    },
    select: {
      id: true,
      name: true,
      _count: { select: { contacts: true } } // counts ContactTag relations
    },
    orderBy: { name: 'asc' },
    take: LIMIT
  });

  for (const t of tagRows) {
    tags.push({ id: t.id, name: t.name, contactCount: t._count.contacts });
  }
}


  // NOTES - semantic search using pgvector cosine distance
  if (doNotes) {
    // IT: never run vector SQL without a valid non-empty embedding
    let vecLiteral: string | null = null;
    try {
      const embed = resolveEmbedHelper();
      // Optional prefilter - very short queries often produce weak embeddings
      // You can disable this if you want single character queries to run
      if (q.length >= 2) {
        const vec = await embed(q);            // expects number[]
        if (Array.isArray(vec) && vec.length > 0) {
          vecLiteral = toVectorLiteral(vec);   // string like "[0.1,0.2,...]"
        }
      }
    } catch (e) {
      console.warn('[search] embedding failed - skipping notes');
    }

    if (vecLiteral) {
      const rows = await prisma.$queryRawUnsafe<Array<{
        id: string;
        contactId: string;
        occurredAt: Date;
        fullNameEnc: string;
        rawTextEnc: string | null;
        score: number;
      }>>(
        `
        SELECT i."id",
               i."contactId",
               i."occurredAt",
               c."fullNameEnc",
               i."rawTextEnc",
               1 - (ie."vec" <=> $2::vector) AS score
        FROM "InteractionEmbedding" ie
        JOIN "Interaction" i ON i."id" = ie."interactionId"
        JOIN "Contact" c ON c."id" = i."contactId"
        WHERE i."userId" = $1
        ORDER BY ie."vec" <=> $2::vector
        LIMIT ${LIMIT}
        `,
        locals.user.id,
        vecLiteral
      );

      for (const r of rows) {
        let contactName = '(name unavailable)';
        let preview = '';
        try { contactName = decrypt(r.fullNameEnc, 'contact.full_name'); } catch {}
        try {
          const text = r.rawTextEnc ? decrypt(r.rawTextEnc, 'interaction.raw_text') : '';
          preview = text.length > 280 ? text.slice(0, 277) + '...' : text;
        } catch {}
        notes.push({
          id: r.id,
          contactId: r.contactId,
          contactName,
          occurredAt: r.occurredAt,
          preview
        });
      }
    }
    // If vecLiteral is null or empty, we intentionally skip the SQL so we never send $2::vector with "[]"
  }

  return {
    q,
    scope,
    results: { contacts, notes, tags }
  };
};
