// Tests for the Spec Desk Claude service: sign-in checks, request limits, the request sent to Claude,
// the streamed reply, and error mapping. Claude is replaced by a stand-in; tokens are signed with a local key.
// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';
import { handle, LIMITS } from '../src/handler.js';

const TENANT = '11111111-2222-3333-4444-555555555555', CLIENT = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const { publicKey, privateKey } = await generateKeyPair('RS256');
const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
const auth = { jwks: createLocalJWKSet({ keys: [jwk] }), tenantId: TENANT, clientId: CLIENT };
const other = await generateKeyPair('RS256');

async function token({ tid = TENANT, aud = `api://${CLIENT}`, scp = 'access_as_user', iss = `https://login.microsoftonline.com/${TENANT}/v2.0`, key = privateKey, exp = '1h' } = {}) {
  return 'Bearer ' + await new SignJWT({ tid, scp, preferred_username: 'pat@cim.example' })
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(key);
}
function fakeClient(reply) {
  const calls = [];
  return { calls, beta: { messages: { stream(req, opts) { calls.push({ req, opts }); return { finalMessage: () => (typeof reply === 'function' ? reply(req, opts) : Promise.resolve(reply)) }; } } } };
}
const okMsg = text => ({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text }], stop_reason: 'end_turn', model: 'claude-opus-5-5', usage: { input_tokens: 10, output_tokens: 5 } });
async function readAll(stream) {
  const r = stream.getReader(), dec = new TextDecoder(); let s = '';
  for (;;) { const { value, done } = await r.read(); if (done) break; s += dec.decode(value, { stream: true }); }
  return s.trim().split('\n').map(l => JSON.parse(l));
}
const body = o => JSON.stringify({ prompt: 'Reply with only JSON: {"ok":true}', ...o });

test('rejects requests without a valid CIM sign-in', async () => {
  const client = fakeClient(okMsg('{}'));
  const cases = {
    'no token': null,
    'wrong tenant': await token({ tid: 'someone-else' }),
    'wrong app': await token({ aud: 'api://another-app' }),
    'missing scope': await token({ scp: 'User.Read' }),
    'wrong signing key': await token({ key: other.privateKey }),
    'expired': await token({ exp: Math.floor(Date.now() / 1000) - 60 }),
    'wrong issuer': await token({ iss: 'https://login.microsoftonline.com/someone-else/v2.0' }),
  };
  for (const [name, a] of Object.entries(cases)) {
    const out = await handle({ authorization: a, rawBody: body() }, { client, auth });
    assert.equal(out.status, 401, name);
    assert.equal(out.json.code, 'not_granted', name);
  }
  assert.equal(client.calls.length, 0, 'Claude is never called without a valid sign-in');
});

test('accepts v1 and v2 tokens for the tenant', async () => {
  for (const iss of [`https://login.microsoftonline.com/${TENANT}/v2.0`, `https://sts.windows.net/${TENANT}/`]) {
    const out = await handle({ authorization: await token({ iss, aud: CLIENT }), rawBody: body() }, { client: fakeClient(okMsg('{"ok":true}')), auth });
    assert.equal(out.status, 200, iss);
  }
});

test('checks the request shape and size before calling Claude', async () => {
  const a = await token(), client = fakeClient(okMsg('{}'));
  const big = 'x'.repeat(LIMITS.promptChars + 1);
  const cases = [
    ['not json', '{oops', 400], ['no prompt', JSON.stringify({}), 400], ['empty prompt', body({ prompt: '  ' }), 400],
    ['prompt too long', body({ prompt: big }), 413],
    ['too many images', body({ images: Array.from({ length: 21 }, () => ({ media_type: 'image/jpeg', data: 'AAAA' })) }), 400],
    ['wrong image type', body({ images: [{ media_type: 'image/gif', data: 'AAAA' }] }), 400],
    ['image too large', body({ images: [{ media_type: 'image/jpeg', data: 'A'.repeat(LIMITS.imageBase64Chars + 1) }] }), 413],
  ];
  for (const [name, raw, status] of cases) {
    const out = await handle({ authorization: a, rawBody: raw }, { client, auth });
    assert.equal(out.status, status, name);
    assert.ok(out.json.error, name);
  }
  assert.equal(client.calls.length, 0);
});

test('sends the prompt and images to Claude Opus 5.5 with adaptive thinking, streaming and refusal fallbacks', async () => {
  const client = fakeClient(okMsg('{"items":[]}'));
  const images = [{ media_type: 'image/jpeg', data: '/9j/AAAA' }, { media_type: 'image/png', data: 'iVBORw0K' }];
  const out = await handle({ authorization: await token(), rawBody: body({ images }) }, { client, auth, env: {} });
  const lines = await readAll(out.stream);
  const { req, opts } = client.calls[0];
  assert.equal(req.model, 'claude-opus-5-5');
  assert.equal(req.max_tokens, 64000);
  assert.deepEqual(req.thinking, { type: 'adaptive' });
  assert.deepEqual(req.output_config, { effort: 'high' });
  assert.deepEqual(req.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(req.fallbacks, 'default');
  const content = req.messages[0].content;
  assert.deepEqual(content.map(c => c.type), ['image', 'image', 'text'], 'images come before the text');
  assert.deepEqual(content[1].source, { type: 'base64', media_type: 'image/png', data: 'iVBORw0K' });
  assert.ok(opts.signal, 'a time limit can stop the request');
  assert.deepEqual(lines.at(-1), { done: true, text: '{"items":[]}', stop_reason: 'end_turn', model: 'claude-opus-5-5' }, 'only text blocks are returned');
});

test('quick tier lowers effort; app settings can change model and effort', async () => {
  const client = fakeClient(okMsg('{}'));
  await readAll((await handle({ authorization: await token(), rawBody: body({ tier: 'quick' }) }, { client, auth, env: {} })).stream);
  assert.deepEqual(client.calls[0].req.output_config, { effort: 'low' });
  await readAll((await handle({ authorization: await token(), rawBody: body() }, { client, auth, env: { CLAUDE_MODEL: 'claude-opus-5', CLAUDE_EFFORT: 'xhigh' } })).stream);
  assert.equal(client.calls[1].req.model, 'claude-opus-5');
  assert.deepEqual(client.calls[1].req.output_config, { effort: 'xhigh' });
});

test('keeps the connection alive while Claude works, then sends the answer', async () => {
  const client = fakeClient(() => new Promise(r => setTimeout(() => r(okMsg('done')), 130)));
  const out = await handle({ authorization: await token(), rawBody: body() }, { client, auth, pingMs: 30 });
  const lines = await readAll(out.stream);
  assert.ok(lines.filter(l => l.ping).length >= 2, 'pings while waiting');
  assert.equal(lines.at(-1).text, 'done');
});

test('reports refusals and Claude errors with codes the page understands', async () => {
  const refusal = { content: [], stop_reason: 'refusal', model: 'claude-opus-5-5', usage: {} };
  let lines = await readAll((await handle({ authorization: await token(), rawBody: body() }, { client: fakeClient(refusal), auth })).stream);
  assert.equal(lines.at(-1).stop_reason, 'refusal');
  const mk = (Cls, status, message) => new Cls(status, { error: { message } }, message, new Headers());
  const cases = [
    [mk(Anthropic.RateLimitError, 429, 'rate'), 'rate_limited'],
    [mk(Anthropic.BadRequestError, 400, 'prompt is too long: 1200000 tokens > 1000000 maximum'), 'prompt_too_large'],
    [mk(Anthropic.BadRequestError, 400, 'messages: bad'), 'invalid_request'],
    [mk(Anthropic.AuthenticationError, 401, 'invalid x-api-key'), 'server_error'],
    [mk(Anthropic.InternalServerError, 500, 'boom'), 'server_error'],
    [new Error('socket hang up'), 'server_error'],
  ];
  const logged = [];
  for (const [err, code] of cases) {
    lines = await readAll((await handle({ authorization: await token(), rawBody: body() }, { client: fakeClient(() => Promise.reject(err)), auth, log: m => logged.push(m) })).stream);
    assert.equal(lines.at(-1).code, code, err.message);
    assert.ok(!JSON.stringify(lines).includes('x-api-key'), 'API details are not sent to the page');
  }
  assert.ok(logged.some(m => /key rejected/.test(m)), 'a bad API key is logged for IT');
});

test('a request that runs too long is stopped', async () => {
  const client = fakeClient((req, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => rej(new Anthropic.APIUserAbortError()))));
  const lines = await readAll((await handle({ authorization: await token(), rawBody: body() }, { client, auth, timeoutMs: 50 })).stream);
  assert.equal(lines.at(-1).code, 'server_error');
  assert.match(lines.at(-1).error, /too long/);
});

test('checks the sign-in before reading the body, and refuses oversized uploads early', async () => {
  let read = 0;
  const readBody = async () => { read++; return body(); };
  let out = await handle({ authorization: null, readBody, contentLength: '50000000' }, { client: fakeClient(okMsg('x')), auth });
  assert.equal(out.status, 401); assert.equal(read, 0, 'body not read without a sign-in');
  out = await handle({ authorization: await token(), readBody, contentLength: String(LIMITS.bodyBytes + 1) }, { client: fakeClient(okMsg('x')), auth });
  assert.equal(out.status, 413); assert.equal(read, 0, 'an oversized upload is refused from its declared length');
  out = await handle({ authorization: await token(), readBody, contentLength: '100' }, { client: fakeClient(okMsg('x')), auth });
  assert.equal(out.status, 200); assert.equal(read, 1);
  await readAll(out.stream);
});

test('stops Claude when the page goes away (Stop pressed, tab closed)', async () => {
  let aborted = false;
  const client = fakeClient((req, opts) => new Promise((_, rej) => opts.signal.addEventListener('abort', () => { aborted = true; rej(new Anthropic.APIUserAbortError()); })));
  const out = await handle({ authorization: await token(), rawBody: body() }, { client, auth, pingMs: 20 });
  const reader = out.stream.getReader();
  await reader.read();                 // the reply has started
  await reader.cancel();               // the browser disconnects
  await new Promise(r => setTimeout(r, 20));
  assert.ok(aborted, 'the Claude request was stopped');
  // and through the request's own signal, where the host provides one
  aborted = false;
  const ctl = new AbortController();
  const out2 = await handle({ authorization: await token(), rawBody: body(), signal: ctl.signal }, { client, auth });
  ctl.abort(); await readAll(out2.stream);
  assert.ok(aborted);
});
