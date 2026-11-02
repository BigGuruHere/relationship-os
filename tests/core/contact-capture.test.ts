import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { issueContactCaptureToken, verifyContactCaptureToken } from '../../src/lib/server/core/contactCaptureToken';
import { runWithExternalWorkspaceCustody, scopeContextPrismaArgs } from '../../src/lib/server/core/contextSpace';

test('capture receipt is bound to profile, anonymous browser, expiry and random submission nonce', () => {
  const profile = randomUUID(), browser = randomUUID(), now = Date.now();
  const a = issueContactCaptureToken(profile, browser, 'qr', now);
  const b = issueContactCaptureToken(profile, browser, 'qr', now);
  assert.notEqual(a,b);
  assert.equal(verifyContactCaptureToken(a,profile,browser,now).via,'qr');
  assert.equal(verifyContactCaptureToken(a,profile,browser,now).nonce,verifyContactCaptureToken(a,profile,browser,now).nonce);
  for(const [p,c,time] of [[randomUUID(),browser,now],[profile,randomUUID(),now],[profile,browser,now+1800001],[profile,browser,now-1]]) assert.throws(()=>verifyContactCaptureToken(a,p as string,c as string,time as number));
  assert.throws(()=>verifyContactCaptureToken(a+'x',profile,browser,now));
  assert.throws(()=>verifyContactCaptureToken('invalid',profile,browser,now));
  assert.equal(verifyContactCaptureToken(issueContactCaptureToken(profile,browser,'invented-event',now),profile,browser,now).via,'profile_link');
});
test('public Contact capture boundary allows new flat Contact and provenance only, denies lookup/updates and nested relation writes', async () => {
  await runWithExternalWorkspaceCustody({targetUserId:'owner',targetContextSpaceId:'private',reason:'PUBLIC_CONTACT_CAPTURE'},async()=>{
    const data={userId:'owner',contextSpaceId:'private',fullNameEnc:'encrypted',fullNameIdx:'index'};
    assert.doesNotThrow(()=>scopeContextPrismaArgs('Contact','create',{data}));
    assert.doesNotThrow(()=>scopeContextPrismaArgs('Interaction','create',{data:{userId:'owner',contextSpaceId:'private',rawTextEnc:'encrypted'}}));
    assert.throws(()=>scopeContextPrismaArgs('Contact','update',{where:{id:'other'},data:{fullNameEnc:'overwrite'}}),/does not permit/);
    assert.throws(()=>scopeContextPrismaArgs('Contact','findFirst',{where:{emailIdx:'guess'}}),/does not permit/);
    assert.throws(()=>scopeContextPrismaArgs('Interaction','deleteMany',{where:{}}),/does not permit/);
    assert.throws(()=>scopeContextPrismaArgs('Contact','create',{data:{...data,person:{create:{}}}}),/nested write/);
    assert.throws(()=>scopeContextPrismaArgs('Contact','create',{data:{...data,userId:'different-owner'}}),/Cross-owner/);
  });
});
