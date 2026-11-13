// Runs the store for the end-to-end tests like it runs in production: the built frontend served by
// the API, here on a fresh SQLite database. Supabase Auth is replaced by a local stand-in, and Stripe
// gets no key, so checkout offers paying on delivery only
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { ADMIN, AUTH_URL, PASSWORD, STORE_URL } from './settings.ts';

const root = path.join(import.meta.dirname, '..');
const issuer = `${AUTH_URL}/auth/v1`;
const { privateKey, publicKey } = await generateKeyPair('ES256');
const jwks = { keys: [{ ...await exportJWK(publicKey), kid: 'e2e', alg: 'ES256', use: 'sig' }] };

// The same email always gets the same user ID, like a real account
function getUserId(email: string) {
  if (email === ADMIN.email) {
    return ADMIN.id;
  }
  const hex = createHash('sha256').update(email).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

// What Supabase answers a password login with
async function createSession(email: string) {
  const user = {
    id: getUserId(email),
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email' },
    user_metadata: {},
    created_at: '2026-01-05T10:00:00.000Z'
  };
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
  const accessToken = await new SignJWT({ role: 'authenticated', email })
    .setProtectedHeader({ alg: 'ES256', kid: 'e2e' })
    .setIssuer(issuer)
    .setAudience('authenticated')
    .setSubject(user.id)
    .setExpirationTime(expiresAt)
    .sign(privateKey);
  return { access_token: accessToken, token_type: 'bearer', expires_in: 3600, expires_at: expiresAt, refresh_token: 'e2e', user };
}

async function readJson(req: http.IncomingMessage) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
  }
  return JSON.parse(body || '{}');
}

function startAuth() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    const send = (status: number, body?: object) => {
      res.writeHead(status, { 'Content-Type': 'application/json' }).end(body && JSON.stringify(body));
    };
    const { pathname, searchParams } = new URL(req.url ?? '/', AUTH_URL);

    if (req.method === 'OPTIONS') {
      return send(204);
    }
    if (pathname === '/auth/v1/.well-known/jwks.json') {
      return send(200, jwks);
    }
    if (req.method === 'POST' && pathname === '/auth/v1/token' && searchParams.get('grant_type') === 'password') {
      const { email, password } = await readJson(req);
      return password === PASSWORD
        ? send(200, await createSession(email))
        : send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    send(404, { error: 'not_found' });
  });
  return new Promise<void>((resolve) => server.listen(Number(new URL(AUTH_URL).port), resolve));
}

// A production build that logs in with the stand-in. Real environment variables win over .env.local
function buildFrontend() {
  const { status } = spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, VITE_SUPABASE_URL: AUTH_URL, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_e2e', VITE_API_URL: '' }
  });
  if (status !== 0) {
    process.exit(status ?? 1);
  }
}

// From an empty folder, so the database starts with the demo data and ecommerce-backend/.env isn't read
function startStore() {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecommerce-e2e-'));
  const store = spawn(process.execPath, [path.join(root, 'ecommerce-backend/server.js')], {
    cwd: workDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      PORT: new URL(STORE_URL).port,
      SUPABASE_URL: AUTH_URL,
      ADMIN_USER_IDS: ADMIN.id,
      DATABASE_URL: '',
      STRIPE_SECRET_KEY: ''
    }
  });
  store.on('exit', (code) => {
    fs.rmSync(workDir, { recursive: true, force: true });
    process.exit(code ?? 0);
  });
  process.on('SIGINT', () => store.kill());
  process.on('SIGTERM', () => store.kill());
}

buildFrontend();
await startAuth();
startStore();
