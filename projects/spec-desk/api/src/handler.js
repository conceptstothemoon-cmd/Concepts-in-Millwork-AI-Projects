// The Spec Desk Claude service, without the Azure wiring, so it can be tested on its own.
//
// The page sends {prompt, images, tier}; this checks the caller's Microsoft 365 sign-in, asks Claude
// (streaming, so long answers don't time out) and writes back newline-delimited JSON:
//   {"ping":1}                                   every few seconds while Claude works (keeps the connection open)
//   {"done":true,"text":"…","stop_reason":"…"}   the answer
//   {"error":"…","code":"…"}                     if something went wrong after the reply started
import Anthropic from '@anthropic-ai/sdk';
import { jwtVerify } from 'jose';

export const LIMITS = {
  bodyBytes: 30 * 1024 * 1024,   // a drawing review with 20 sheet images is about 10 MB
  promptChars: 1_500_000,        // the page never sends more than about 120,000 characters
  images: 20,
  imageBase64Chars: 7_000_000,   // about 5 MB per image
};
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Returns the signed-in person's name, or null. Only CIM accounts with the access_as_user scope get through.
export async function checkUser(authHeader, { jwks, tenantId, clientId }) {
  const token = String(authHeader || '').startsWith('Bearer ') ? String(authHeader).slice(7) : '';
  if (!token || !jwks || !tenantId || !clientId) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      // Entra issues v1 or v2 tokens depending on the app registration; accept either for this tenant.
      issuer: [`https://login.microsoftonline.com/${tenantId}/v2.0`, `https://sts.windows.net/${tenantId}/`],
      audience: [clientId, `api://${clientId}`],
    });
    const scopes = String(payload.scp || '').split(' ');
    if (payload.tid !== tenantId || !scopes.includes('access_as_user')) return null;
    return payload.preferred_username || payload.upn || payload.oid || 'signed-in user';
  } catch {
    return null;
  }
}

export function parseBody(raw) {
  if (raw.length > LIMITS.bodyBytes) throw new HttpError(413, 'That request is too large.');
  let body;
  try { body = JSON.parse(raw); } catch { throw new HttpError(400, 'The request wasn’t valid JSON.'); }
  const prompt = body && body.prompt;
  if (typeof prompt !== 'string' || !prompt.trim()) throw new HttpError(400, 'prompt must be text.');
  if (prompt.length > LIMITS.promptChars) throw new HttpError(413, 'That was too much text for one request.');
  const images = body.images === undefined ? [] : body.images;
  if (!Array.isArray(images) || images.length > LIMITS.images) throw new HttpError(400, `images must be a list of at most ${LIMITS.images}.`);
  for (const im of images) {
    if (!im || !IMAGE_TYPES.has(im.media_type) || typeof im.data !== 'string' || !im.data) throw new HttpError(400, 'Each image needs media_type (image/jpeg or image/png) and base64 data.');
    if (im.data.length > LIMITS.imageBase64Chars) throw new HttpError(413, 'An image is too large.');
  }
  return { prompt, images, tier: body.tier === 'quick' ? 'quick' : 'default' };
}

// The model is the same for both tiers; "quick" (reading RE: references, matching columns) only lowers effort.
export function settingsFor(tier, env) {
  return {
    model: env.CLAUDE_MODEL || 'claude-opus-5-5',
    effort: tier === 'quick' ? (env.CLAUDE_EFFORT_QUICK || 'low') : (env.CLAUDE_EFFORT || 'high'),
  };
}

export function requestFor({ prompt, images }, { model, effort }) {
  return {
    model,
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort },
    // If Claude's safety checks decline a request, the API retries it on a fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{
      role: 'user',
      content: [
        ...images.map(im => ({ type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.data } })),
        { type: 'text', text: prompt },
      ],
    }],
  };
}

export function errorFor(e) {
  if (e instanceof Anthropic.RateLimitError) return { status: 429, code: 'rate_limited', error: 'Too many requests right now.' };
  if (e instanceof Anthropic.BadRequestError) return { status: 400, code: /too long|too large|exceed/i.test(e.message) ? 'prompt_too_large' : 'invalid_request', error: e.message };
  if (e instanceof Anthropic.AuthenticationError) return { status: 502, code: 'server_error', error: 'The Claude service is not set up correctly.', log: 'Claude API key rejected' };
  if (e instanceof Anthropic.APIUserAbortError || (e && e.name === 'AbortError')) return { status: 504, code: 'server_error', error: 'Claude took too long to answer.' };
  if (e instanceof Anthropic.APIError) return { status: 502, code: 'server_error', error: 'Claude is unavailable right now.', log: `Claude API error ${e.status}: ${e.message}` };
  return { status: 500, code: 'server_error', error: 'Something went wrong.', log: String(e && e.stack || e) };
}

// Handles one request. req: { authorization, contentLength, readBody() } (or rawBody, in tests).
// deps: { client, auth: {jwks, tenantId, clientId}, env, log, pingMs, timeoutMs }.
// Returns {status, json} for errors found before Claude is called, or {status: 200, stream} with the NDJSON reply.
// The sign-in is checked before the body is read, so nobody without it can make the function hold a large upload.
export async function handle(req, deps) {
  const user = await checkUser(req.authorization, deps.auth);
  if (!user) return { status: 401, json: { error: 'Sign in with your CIM Microsoft 365 account.', code: 'not_granted' } };
  if (+req.contentLength > LIMITS.bodyBytes) return { status: 413, json: { error: 'That request is too large.', code: 'prompt_too_large' } };
  let input;
  try { input = parseBody(typeof req.readBody === 'function' ? await req.readBody() : req.rawBody); } catch (e) { return { status: e.status || 400, json: { error: e.message, code: e.status === 413 ? 'prompt_too_large' : 'invalid_request' } }; }
  const set = settingsFor(input.tier, deps.env || {});
  const enc = new TextEncoder();
  const line = obj => enc.encode(JSON.stringify(obj) + '\n');
  // Stopped when the page goes away (Stop, closed tab) or after 9 minutes, so Claude isn't left working and billing.
  const abort = new AbortController();
  if (req.signal) req.signal.addEventListener('abort', () => abort.abort(), { once: true });
  const stream = new ReadableStream({
    cancel() { abort.abort(); },
    async start(ctl) {
      const send = obj => { try { ctl.enqueue(line(obj)); } catch { /* the page has gone */ } };
      const ping = setInterval(() => send({ ping: 1 }), deps.pingMs || 10000);
      const timer = setTimeout(() => abort.abort(), deps.timeoutMs || 9 * 60 * 1000);
      try {
        const msg = await deps.client.beta.messages.stream(requestFor(input, set), { signal: abort.signal }).finalMessage();
        const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
        const u = msg.usage || {};
        deps.log && deps.log(`claude ok user=${user} tier=${input.tier} images=${input.images.length} in=${u.input_tokens} out=${u.output_tokens} stop=${msg.stop_reason}`);
        send({ done: true, text, stop_reason: msg.stop_reason, model: msg.model });
      } catch (e) {
        const r = errorFor(e);
        if (r.log && deps.log) deps.log(r.log);
        send({ error: r.error, code: r.code });
      } finally {
        clearInterval(ping); clearTimeout(timer);
        try { ctl.close(); } catch { /* already cancelled */ }
      }
    },
  });
  return { status: 200, stream };
}
