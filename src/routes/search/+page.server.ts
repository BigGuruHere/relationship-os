// src/routes/search/+page.server.ts
// PURPOSE: Perform scoped search across Contacts - Notes - Tags. Supports an "All" scope.
// MULTI TENANT: Every query filters by userId.
// SECURITY: Decrypt only on the server. Never log decrypted PII.
// VECTORS: Use pgvector cosine distance with ::vector casts. Never execute with an empty vector.

import type { PageServerLoad } from './$types';
import { prisma } from '$lib/db';
import { decrypt, buildIndexToken } from '$lib/crypto';
import * as Emb from '$lib/embeddings';
import { semanticSearchInteractions } from '$lib/embeddings'; // add this import at top next to others


type Scope = 'all' | 'contacts' | 'notes' | 'tags' | 'company';
const LIMIT = 20; // keep UI snappy

// IT: resolve an embedding helper without tying you to one function name
function resolveEmbedHelper() {
  const candidates = [
    ['embedQuery', (Emb as any).embedQuery],
    ['embedText', (Emb as any).embedText],
    ['getEmbeddingForSearch', (Emb as any).getEmbeddingForSearch],
    ['getEmbedding', (Emb as any).getEmbedding]
  ];
  for (const [name, fn] of candidates) {
    if (typeof fn === 'function') {
      console.debug('[search] using embedding helper:', name);
      return fn as (text: string) => Promise<number[]>;
    }
  }
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
  const doCompany = scope === 'company' || scope === 'all' || scope === 'contacts';

  // ...
  const contacts: Array<{ id: string; name: string; email: string; phone: string; company: string; tags: { name: string }[]; }> = [];
  const notes: Array<{ id: string; contactId: string; contactName: string; occurredAt: Date; preview: string; }> = [];
  const tags: Array<{ id: string; name: string; contactCount: number; }> = [];

  // CONTACTS - exact matches via deterministic indexes - now includes companyIdx
  if (doContacts || doCompany) {
    const token = buildIndexToken(q);

    // IT: exact equality matches on deterministic indexes - fast and indexed
    const exactRows = await prisma.contact.findMany({
      where: {
        userId: locals.user.id,
        OR: [
          ...(doContacts ? [{ fullNameIdx: token }, { emailIdx: token }, { phoneIdx: token }] : []),
          ...(doCompany ? [{ companyIdx: token }] : [])
        ]
      },
      select: {
        id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, companyEnc: true,
        tags: { select: { tag: { select: { name: true } } }, take: 12 }
      },
      take: LIMIT
    });

    // IT: tag name matches only when searching contacts or all - not needed for company-only scope
    const tagRows = (doContacts && scope !== 'company')
      ? await prisma.contact.findMany({
          where: {
            userId: locals.user.id,
            tags: { some: { tag: { name: { contains: q, mode: 'insensitive' } } } }
          },
          select: {
            id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, companyEnc: true,
            tags: { select: { tag: { select: { name: true } } }, take: 12 }
          },
          take: LIMIT
        })
      : [];

    // IT: optional partial company match - decrypt small slice and filter in memory
    // This gives a practical contains search without exposing plaintext to the DB
    let companyContains: typeof exactRows = [];
    if (doCompany) {
      const sample = await prisma.contact.findMany({
        where: { userId: locals.user.id },
        select: {
          id: true, fullNameEnc: true, emailEnc: true, phoneEnc: true, companyEnc: true,
          tags: { select: { tag: { select: { name: true } } }, take: 12 }
        },
        take: 300 // IT: keep bounded for perf - adjust if needed
      });

      const qLower = q.toLowerCase();
      companyContains = sample.filter((r) => {
        try {
          if (!r.companyEnc) return false;
          const company = decrypt(r.companyEnc, 'contact.company') || '';
          return company.toLowerCase().includes(qLower);
        } catch {
          return false;
        }
      }).slice(0, LIMIT);
    }

    // IT: merge rows without duplicates, keep order by preference: exact -> companyContains -> tagRows
    const rows = [...exactRows, ...companyContains, ...tagRows];
    const seen = new Set<string>();

    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);

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
    try {
      // IT: run semantic search with one function that computes the query embedding and ranks matches
      const top = await semanticSearchInteractions({
        userId: locals.user.id,
        query: q,
        topK: LIMIT,
        minScore: 0.15 // tweak to taste
      });

      const ids = top.map((t) => t.interactionId);
      if (ids.length) {
        // IT: fetch minimal display fields for the matched interactions
        const rows = await prisma.interaction.findMany({
          where: { id: { in: ids }, userId: locals.user.id },
          select: {
            id: true,
            contactId: true,
            occurredAt: true,
            rawTextEnc: true,
            contact: { select: { fullNameEnc: true } }
          }
        });

        // IT: maintain order by score
        const position = new Map(ids.map((id, i) => [id, i]));

        rows.sort((a, b) => (position.get(a.id)! - position.get(b.id)!));

        for (const r of rows) {
          let contactName = '(name unavailable)';
          let preview = '';
          try { if (r.contact.fullNameEnc) contactName = decrypt(r.contact.fullNameEnc, 'contact.full_name'); } catch {}
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
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[search] notes retrieval failed -', msg);
    }
  }
  return {
    q,
    scope,
    results: { contacts, notes, tags }
  };
};
