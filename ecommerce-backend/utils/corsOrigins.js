// Comma-separated list of frontend origins allowed to call the API from another domain. In production
// the API serves the store itself, which needs none, so only the Vite dev server is allowed by default
const defaultOrigins = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';

export const corsOrigins = (process.env.CORS_ORIGIN || defaultOrigins)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
