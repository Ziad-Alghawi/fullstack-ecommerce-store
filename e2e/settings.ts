export const STORE_URL = 'http://localhost:4310';
// The stand-in for Supabase Auth, which the frontend is built to log in with
export const AUTH_URL = 'http://localhost:4311';

// The stand-in for the Anthropic API, which the shopping assistant talks to
export const ANTHROPIC_URL = 'http://localhost:4312';

// Every account logs in with this password. Only the admin is in ADMIN_USER_IDS
export const PASSWORD = 'e2e-password';
export const ADMIN = { id: 'a0000000-0000-4000-8000-000000000001', email: 'admin@example.com' };
