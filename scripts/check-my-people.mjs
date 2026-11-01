// Explicit local-only regression check. Creates and removes only its own fixture accounts.
// Start the built app locally first; no provider or production connection is needed.
import assert from 'node:assert/strict';
import { randomUUID, createHmac, createHash } from 'node:crypto';
import { writeFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'vite';

const dbUrl = new URL(process.env.DATABASE_URL || '');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.port, '5432');
assert.equal(dbUrl.pathname, '/relish_local');
const origin = process.env.PEOPLE_TEST_ORIGIN || 'http://127.0.0.1:5175';
assert.equal(new URL(origin).hostname, '127.0.0.1');
const db = new PrismaClient();
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const owners = [randomUUID(), randomUUID()];
const spaces = [randomUUID(), randomUUID()];
const fixtureFile = '/tmp/relish-my-people-browser.json';
const originalFetch = globalThis.fetch;
let count = 0;
const check = (message) => { count++; console.log('PASS ' + message); };
const fingerprint = async () => createHash('sha256').update(JSON.stringify(await db.contact.findMany({ where: { userId: { notIn: owners } }, orderBy: { id: 'asc' } }))).update(JSON.stringify(await db.interaction.findMany({ where: { userId: { notIn: owners } }, orderBy: { id: 'asc' } }))).digest('hex');
const before = await fingerprint();
const cookies = [];
const fixturePersons = [];
async function request(path, i = 0, form) {
  return originalFetch(origin + path, { redirect: 'manual', headers: { accept: 'text/html', cookie: 'rsid_dev=' + cookies[i], ...(form ? { origin } : {}) }, ...(form ? { method: 'POST', body: new URLSearchParams(form) } : {}) });
}
try {
  const { encrypt, buildIndexToken } = await vite.ssrLoadModule('/src/lib/crypto.ts');
  for (let i = 0; i < owners.length; i++) {
    const fixtureUser = await db.user.create({ data: { id: owners[i], role: i ? 'member' : 'owner', person: { create: {} } }, select: { personId: true } });
    fixturePersons.push(fixtureUser.personId);
    if (i === 0) spaces[i] = owners[i]; // Existing User trigger creates the legacy default Business space.
    await db.contextSpace.upsert({ where: { id: spaces[i] }, update: {}, create: { id: spaces[i], ownerUserId: owners[i], domainKey: i ? 'general' : 'business' } });
    await db.user.update({ where: { id: owners[i] }, data: { defaultContextSpaceId: spaces[i] } });
    const raw = randomUUID();
    const expiresAt = new Date(Date.now() + 3600000);
    const session = await db.session.create({ data: { userId: owners[i], tokenHash: createHmac('sha256', process.env.SESSION_COOKIE_SECRET).update(raw).digest('base64url'), expiresAt } });
    const payload = Buffer.from(JSON.stringify({ id: session.id, t: raw })).toString('base64url');
    cookies.push(payload + '.' + createHmac('sha256', process.env.SESSION_COOKIE_SECRET).update(payload).digest('base64url'));
  }
  const legacy = await db.contact.create({ data: { userId: owners[0], contextSpaceId: spaces[0], fullNameEnc: encrypt('Legacy Brokerage Fixture', 'contact.full_name'), fullNameIdx: buildIndexToken('Legacy Brokerage Fixture') } });
  const legacyBefore = await db.contact.findUniqueOrThrow({ where: { id: legacy.id } });
  const legacyNote = await db.interaction.create({ data: { userId: owners[0], contextSpaceId: spaces[0], contactId: legacy.id, channel: 'note', rawTextEnc: encrypt('Legacy private history', 'interaction.raw_text') } });
  assert.equal((await originalFetch(origin + '/people', { redirect: 'manual' })).status, 303);
  check('anonymous People access denied');
  await request('/people');
  assert.equal(await db.contextSpace.count({ where: { ownerUserId: owners[0], domainKey: 'private' } }), 0);
  check('GET does not provision storage');
  const invalid = await request('/people/new', 0, { name: '', contextSpaceId: spaces[1], userId: owners[1] });
  assert.equal(invalid.status, 400);
  assert.equal(await db.contextSpace.count({ where: { ownerUserId: owners[0], domainKey: 'private' } }), 0);
  const added = await request('/people/new', 0, { name: 'Sarah Pilot', email: 'sarah@example.test', phone: '0412 345 678', contextSpaceId: spaces[1], userId: owners[1] });
  assert.equal(added.status, 303);
  const personPath = added.headers.get('location');
  const id = personPath.split('/').at(-1);
  const contact = await db.contact.findUniqueOrThrow({ where: { id } });
  assert.equal(contact.userId, owners[0]);
  assert.equal(contact.personId, null); assert.equal(contact.linkedUserId, null);
  const space = await db.contextSpace.findUniqueOrThrow({ where: { id: contact.contextSpaceId } });
  assert.equal(space.domainKey, 'private'); assert.equal(space.ownerUserId, owners[0]);
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: owners[0] } })).defaultContextSpaceId, spaces[0]);
  check('manual capture ignores forged custody, creates unlinked Contact, preserves default');
  assert.equal((await request('/people/new', 0, { name: 'Sarah Pilot' })).status, 303);
  assert.equal(await db.contact.count({ where: { userId: owners[0], fullNameIdx: buildIndexToken('Sarah Pilot') } }), 2);
  check('same-name people allowed');
  await assert.rejects(db.contact.create({ data: { userId: owners[0], contextSpaceId: spaces[1], fullNameEnc: encrypt('Forbidden', 'contact.full_name'), fullNameIdx: buildIndexToken('Forbidden') } }));
  await assert.rejects(db.interaction.create({ data: { userId: owners[0], contextSpaceId: space.id, contactId: legacy.id, channel: 'note', rawTextEnc: encrypt('Forbidden link', 'interaction.raw_text') } }));
  check('database guards reject another owner storage home and cross-context Contact/Interaction links');
  for (const [i, idToUse] of [[1,id],[0,legacy.id]]) assert.equal((await request('/people/' + idToUse, i)).status, 404);
  check('other-owner and own Brokerage Contacts denied on private routes');
  assert.equal((await request('/contacts/' + legacy.id)).status, 200);
  assert.equal((await request('/broker/contacts')).status, 200);
  const brokerageCreated = await request('/contacts/new?/create', 0, { fullName: 'New Brokerage Fixture', sourceChoice: 'builtin:MANUAL' });
  assert.equal(brokerageCreated.status, 303);
  const brokerageId = brokerageCreated.headers.get('location').split('/').at(-1);
  assert.equal((await db.contact.findUniqueOrThrow({ where: { id: brokerageId } })).contextSpaceId, spaces[0]);
  assert.equal((await request('/people/' + brokerageId)).status, 404);
  assert.ok(!(await (await request('/people')).text()).includes('Legacy Brokerage Fixture'));
  check('legacy Contact/Brokerage routes and shared creation work, with Brokerage contacts excluded from My People');
  const text = 'I met Sarah on the networking walk. This is my observation.';
  assert.equal((await request(personPath + '/notes/new?/save', 0, { text, channel: 'voice note', luAdmission: 'ELIGIBLE', createEmbedding: 'true' })).status, 303);
  const note = await db.interaction.findFirstOrThrow({ where: { contactId: id } });
  assert.equal(note.contextSpaceId, space.id); assert.equal(note.userId, owners[0]); assert.equal(note.luAdmission, 'STORED_ONLY'); assert.equal(note.channel, 'OWNER_VOICE_NOTE'); assert.equal(note.sourceType, 'WORKSPACE'); assert.ok(!note.rawTextEnc.includes('Sarah'));
  assert.equal(await db.interactionEmbedding.count({ where: { interactionId: note.id } }), 0);
  assert.equal((await db.contact.findUniqueOrThrow({ where: { id } })).lastContactedAt, null);
  assert.ok((await (await request(personPath)).text()).includes(text));
  check('editable text stored encrypted, retrievable, no embedding/LU/contact-date side effects');
  assert.equal((await request(personPath + '/notes/new?/save', 1, { text: 'attack' })).status, 404);
  assert.equal(await db.interaction.count({ where: { contactId: id } }), 1);
  check('cross-owner save denied');
  const privateSpace = await vite.ssrLoadModule('/src/lib/server/core/myPeople.ts');
  const [concurrentA, concurrentB] = await Promise.all([privateSpace.ensurePrivatePeopleSpace(owners[1]), privateSpace.ensurePrivatePeopleSpace(owners[1])]);
  assert.equal(concurrentA.id, concurrentB.id);
  check('concurrent initial provisioning is idempotent');

  // Test the real shared upload/poll handlers with only the provider fetch replaced locally.
  const { POST: upload } = await vite.ssrLoadModule('/src/routes/people/api/upload-chunk/+server.ts');
  const { GET: poll } = await vite.ssrLoadModule('/src/routes/people/api/transcribe-result/+server.ts');
  const locals = { user: { id: owners[0], role: 'owner' }, contextDomainKey: 'private', contextSpaceId: space.id };
  const key = randomUUID();
  const event = (key, index, last, local = locals, mime = 'audio/mp4') => { const url = new URL(`${origin}/people/api/upload-chunk?key=${key}&index=${index}&last=${last}&mime=${mime}`); return { locals: local, url, request: new Request(url, { method: 'POST', body: index === 0 ? new Uint8Array([1,2,3]) : new Uint8Array() }) }; };
  const custody = await vite.ssrLoadModule('/src/lib/server/core/contextSpace.ts');
  const inCustody = fn => custody.runWithWorkspaceCustody({userId:owners[0],contextSpaceId:space.id},fn);
  assert.equal((await inCustody(() => upload(event(key,0,0)))).status, 200);
  assert.equal((await upload(event(key,1,0,{...locals,user:{id:owners[1]},contextSpaceId:concurrentA.id}))).status,409);
  assert.equal((await inCustody(() => upload(event(key,3,0)))).status,409);
  check('audio ownership and chunk ordering enforced');
  const previousKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'offline-test-provider';
  let providerRequests = 0;
  globalThis.fetch = async (url) => { assert.equal(String(url), 'https://api.openai.com/v1/audio/transcriptions'); providerRequests++; return new Response('Offline transcription fixture',{status:200,headers:{'content-type':'text/plain'}}); };
  let jobId;
  try {
    const result = await inCustody(() => upload(event(key,1,1)));
    assert.equal(result.status,202); jobId = (await result.json()).jobId;
    for(let i=0;i<100;i++) {
      const url = new URL(origin + '/people/api/transcribe-result?jobId=' + jobId);
      const denied = await poll({locals:{...locals,user:{id:owners[1]},contextSpaceId:concurrentA.id},url}); assert.equal(denied.status,404);
      const result = await poll({locals,url}); const data = await result.json();
      if(data.status==='done'){assert.equal(data.transcript,'Offline transcription fixture');break;}
      assert.ok(i<99,'transcription completed');await new Promise(r=>setTimeout(r,20));
    }
    assert.equal(providerRequests,1);
  } finally { globalThis.fetch=originalFetch; if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey; }
  check('real private upload/poll transcribes with offline provider, denies other owner');
  await writeFile(fixtureFile,JSON.stringify({origin,cookie:cookies[0],personPath}),{mode:0o600});
  const browser = spawnSync('python',['scripts/check-my-people-browser.py',fixtureFile],{stdio:'inherit'});
  assert.equal(browser.status,0);check('mobile browser capture/edit/save/retrieve flow');
  assert.deepEqual(await db.contact.findUniqueOrThrow({ where: { id: legacy.id } }), legacyBefore);
  assert.deepEqual(await db.interaction.findUniqueOrThrow({ where: { id: legacyNote.id } }), legacyNote);
  assert.equal(await fingerprint(),before);
  check('all pre-existing Contacts and Interactions unchanged');
  console.log(`${count} integration checks passed`);
} finally {
  globalThis.fetch=originalFetch;
  await unlink(fixtureFile).catch(()=>{});
  await db.user.deleteMany({ where: { id: { in: owners } } });
  // Fixture Persons have no private records and were created only by this test.
  await db.person.deleteMany({ where: { id: { in: fixturePersons } } });
  await vite.close();await db.$disconnect();
}
