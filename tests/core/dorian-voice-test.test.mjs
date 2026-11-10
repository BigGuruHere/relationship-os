// Exercise the DEV token boundary without contacting ElevenLabs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createServer } from 'vite';

test('Dorian voice test issues only a token on the canonical DEV origin for an owner', async () => {
  const server = await createServer({
    configFile: false,
    resolve: { alias: { $lib: resolve('src/lib') } },
    server: { middlewareMode: true }
  });
  const keys = ['RELISH_DORIAN_WEB_TEST_AGENT_ID', 'ELEVENLABS_API_KEY'];
  const previous = keys.map(key => process.env[key]);
  try {
    const { load, actions } = await server.ssrLoadModule('/src/routes/settings/dorian-voice-test/+page.server.ts');
    const url = new URL('https://dev.relish.live/settings/dorian-voice-test');
    let calls = 0;
    const event = {
      url,
      locals: { env: 'dev', user: { role: 'owner' } },
      request: new Request(url, { method: 'POST', headers: { origin: url.origin } }),
      setHeaders: headers => assert.equal(headers['cache-control'], 'private, no-store'),
      fetch: async (endpoint, options) => {
        calls++;
        assert.equal(endpoint.origin, 'https://api.elevenlabs.io');
        assert.equal(endpoint.searchParams.get('agent_id'), 'agent_test');
        assert.equal(options.headers['xi-api-key'], 'test-key');
        return Response.json({ token: 'test-token', other: 'not returned' });
      }
    };
    delete process.env.RELISH_DORIAN_WEB_TEST_AGENT_ID;
    assert.throws(() => load(event), e => e.status === 404);
    process.env.RELISH_DORIAN_WEB_TEST_AGENT_ID = 'agent_test';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    for (const denied of [
      { ...event, locals: { ...event.locals, env: 'prod' } },
      { ...event, locals: { ...event.locals, user: { role: 'member' } } },
      { ...event, url: new URL('https://other.example/settings/dorian-voice-test') }
    ]) {
      assert.throws(() => load(denied), e => e.status === 404);
      await assert.rejects(actions.default(denied), e => e.status === 404);
    }
    assert.equal((await actions.default({ ...event, request: new Request(url, { method: 'POST' }) })).status, 403);
    assert.equal(calls, 0);
    load(event);
    assert.deepEqual(await actions.default(event), { token: 'test-token' });
    assert.equal(calls, 1);
  } finally {
    for (const [i, key] of keys.entries()) {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }
    await server.close();
  }
});
