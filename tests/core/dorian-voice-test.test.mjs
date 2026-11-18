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
  const original = { info: console.info, warn: console.warn };
  const diagnostics = [];
  console.info = console.warn = line => diagnostics.push(JSON.parse(line));
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
    const issued = await actions.default(event);
    assert.deepEqual(issued, { token: 'test-token', reference: diagnostics.at(-1).reference });
    assert.equal(diagnostics.at(-1).reason, 'issued');
    assert.equal(calls, 1);

    const rejected = await actions.default({
      ...event, fetch: async () => Response.json({
        detail: { status: 'missing_permissions', message: 'private-agent-id' }
      }, { status: 403 })
    });
    assert.equal(rejected.status, 502);
    assert.equal(rejected.data.reference, diagnostics.at(-1).reference);
    assert.equal(diagnostics.at(-1).upstreamStatus, 403);
    assert.equal(diagnostics.at(-1).providerCode, 'missing_permissions');

    await actions.default({ ...event, fetch: async () => new Response('unexpected', { status: 200 }) });
    assert.equal(diagnostics.at(-1).reason, 'invalid_provider_response');
    await actions.default({
      ...event, fetch: async () => { throw new Error('private-network-error'); }
    });
    assert.equal(diagnostics.at(-1).reason, 'provider_request_failed');
    assert.doesNotMatch(JSON.stringify(diagnostics), /test-key|test-token|agent_test|private-agent-id|private-network-error/);
  } finally {
    Object.assign(console, original);
    for (const [i, key] of keys.entries()) {
      if (previous[i] === undefined) delete process.env[key];
      else process.env[key] = previous[i];
    }
    await server.close();
  }
});
