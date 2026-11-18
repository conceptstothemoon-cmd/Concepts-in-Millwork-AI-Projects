// POST /api/claude
//
// The Spec Desk page sends one Claude request here: a prompt, optional sheet images, and a tier
// ("quick" or "default"). This function adds the API key (kept only in the Function App's settings)
// and asks Claude. Only people signed in to CIM's Microsoft 365 can use it: every request must carry
// an Entra ID access token for the "CIM Spec Desk" app with the access_as_user scope.
// The model, token limit and request size are fixed on this side, so the page can't change them.
//
// The answer is streamed back as newline-delimited JSON so long comparisons and drawing reviews
// don't hit Azure's 230-second idle limit (see src/handler.js).
//
// App settings: ANTHROPIC_API_KEY, TENANT_ID, CLIENT_ID; optionally CLAUDE_MODEL, CLAUDE_EFFORT, CLAUDE_EFFORT_QUICK.
import { app } from '@azure/functions';
import Anthropic from '@anthropic-ai/sdk';
import { createRemoteJWKSet } from 'jose';
import { handle } from '../handler.js';

app.setup({ enableHttpStream: true });

const TENANT_ID = process.env.TENANT_ID;
const deps = {
  client: new Anthropic(), // reads ANTHROPIC_API_KEY
  auth: {
    tenantId: TENANT_ID,
    clientId: process.env.CLIENT_ID,
    jwks: TENANT_ID ? createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)) : null,
  },
  env: process.env,
};

app.http('claude', {
  methods: ['POST'],
  authLevel: 'anonymous', // access is checked with the Microsoft 365 token in handler.js
  handler: async (request, context) => {
    const out = await handle(
      { authorization: request.headers.get('authorization'), rawBody: await request.text() },
      { ...deps, log: m => context.log(m) },
    );
    if (out.json) return { status: out.status, jsonBody: out.json };
    return { status: 200, headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' }, body: out.stream };
  },
});
