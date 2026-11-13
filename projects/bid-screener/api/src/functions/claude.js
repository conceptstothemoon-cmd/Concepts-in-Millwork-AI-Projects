// POST /api/claude
//
// The Bid Screener page sends a Claude conversation here; this function adds the API key
// (kept only in the Function App's settings) and forwards it to Claude.
//
// Only people signed in to CIM's Microsoft 365 can use it: every request must carry an
// Entra ID access token for the "CIM Bid Screener" app with the access_as_user scope.
// The model, token limit and request size are fixed here, so the page can't change them.
//
// App settings: ANTHROPIC_API_KEY, TENANT_ID, CLIENT_ID, and optionally CLAUDE_MODEL.
import { app } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const TENANT_ID = process.env.TENANT_ID;
const CLIENT_ID = process.env.CLIENT_ID;
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const MAX_BODY_CHARS = 600_000;
const EFFORTS = new Set(['low', 'medium', 'high']);

const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const jwks = TENANT_ID ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)) : null;

async function checkUser(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !jwks || !CLIENT_ID) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, {
      // Entra issues v1 or v2 tokens depending on the app registration; accept either for this tenant.
      issuer: [`https://login.microsoftonline.com/${TENANT_ID}/v2.0`, `https://sts.windows.net/${TENANT_ID}/`],
      audience: [CLIENT_ID, `api://${CLIENT_ID}`],
    });
    const scopes = String(payload.scp || '').split(' ');
    if (payload.tid !== TENANT_ID || !scopes.includes('access_as_user')) return null;
    return payload.preferred_username || payload.upn || payload.oid || 'signed-in user';
  } catch {
    return null;
  }
}

function cleanTools(tools) {
  if (tools === undefined) return undefined;
  if (!Array.isArray(tools) || tools.length > 8) throw new Error('tools must be a list of at most 8');
  return tools.map(t => {
    if (!t || typeof t.name !== 'string' || typeof t.description !== 'string' || typeof t.input_schema !== 'object') throw new Error('each tool needs name, description and input_schema');
    return { name: t.name, description: t.description, input_schema: t.input_schema };
  });
}

const reply = (status, body) => ({ status, jsonBody: body });

app.http('claude', {
  methods: ['POST'],
  authLevel: 'anonymous', // access is checked with the Microsoft 365 token above
  handler: async (request, context) => {
    const user = await checkUser(request);
    if (!user) return reply(401, { error: 'Sign in with your CIM Microsoft 365 account.' });

    const raw = await request.text();
    if (raw.length > MAX_BODY_CHARS) return reply(413, { error: 'That request is too large.' });

    let messages, tools, effort;
    try {
      const body = JSON.parse(raw);
      messages = body.messages;
      if (!Array.isArray(messages) || !messages.length || messages.length > 60) throw new Error('messages must be a list of 1 to 60');
      tools = cleanTools(body.tools);
      effort = EFFORTS.has(body.effort) ? body.effort : 'medium';
    } catch (e) {
      return reply(400, { error: e.message });
    }

    try {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort },
        messages,
        ...(tools ? { tools } : {}),
        // If Claude's safety checks decline a request, let the API retry it on a fallback model.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      context.log(`claude ok user=${user} effort=${effort} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`);
      return reply(200, { content: response.content, stop_reason: response.stop_reason, model: response.model });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError) return reply(429, { error: 'Too many requests right now.' });
      if (e instanceof Anthropic.BadRequestError) return reply(400, { error: e.message });
      if (e instanceof Anthropic.AuthenticationError) { context.error('Claude API key rejected'); return reply(502, { error: 'The Claude service is not set up correctly.' }); }
      if (e instanceof Anthropic.APIError) { context.error(`Claude API error ${e.status}: ${e.message}`); return reply(502, { error: 'Claude is unavailable right now.' }); }
      context.error(e);
      return reply(500, { error: 'Something went wrong.' });
    }
  },
});
