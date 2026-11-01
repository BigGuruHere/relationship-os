import test from 'node:test';
import assert from 'node:assert/strict';
import { contextDomainForPathname } from '../../src/lib/server/core/contextDomain';
import { scopedEntityWhere } from '../../src/lib/server/core/scopedRepository';
import { validateContactDetails } from '../../src/lib/server/core/contacts';

test('People pages and audio endpoints use private custody without changing legacy route domains', () => {
  for (const path of ['/people','/people/new','/people/id/notes/new','/people/api/upload-chunk','/people/api/transcribe-result']) assert.equal(contextDomainForPathname(path),'private');
  for (const path of ['/contacts/id','/broker/contacts','/people-other']) assert.equal(contextDomainForPathname(path),'business');
  assert.equal(contextDomainForPathname('/space/friendship/people'),'general');
});
test('basic Contact validation requires only a name and does not infer identity or a phone country', () => {
  assert.deepEqual(validateContactDetails({ name: '  Sarah  ', phone: '0412 345 678' }), { name: 'Sarah', email: '', phone: '0412 345 678' });
  assert.deepEqual(validateContactDetails({ name: 'Sarah' }), { name: 'Sarah', email: '', phone: '' });
  for (const value of [{name:''},{name:'a'.repeat(201)},{name:'Sarah',email:'bad'},{name:'Sarah',phone:'not a phone'}]) assert.throws(() => validateContactDetails(value));
});
test('Contact lookup always includes both the authenticated owner and storage home', () => {
  assert.deepEqual(scopedEntityWhere({workspaceUserId:'owner-a',contextSpaceId:'private-a'},'contact-id'),{id:'contact-id',userId:'owner-a',contextSpaceId:'private-a'});
});

// Importing ordinary CRM services must not require credentials for optional enrichment.
test('embeddings remain optional at import and fail explicitly only on nonempty requests', async () => {
  const { createEmbeddingForText } = await import('../../src/lib/embeddings_api');
  const before = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    assert.deepEqual(await createEmbeddingForText('   '), []);
    await assert.rejects(createEmbeddingForText('real input'), /Embeddings require OPENAI_API_KEY/);
  } finally { if (before !== undefined) process.env.OPENAI_API_KEY = before; }
});
