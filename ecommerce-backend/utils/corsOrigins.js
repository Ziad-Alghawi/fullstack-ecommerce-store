import { publicSiteUrl } from './publicSiteUrl.js';

// Comma-separated list of frontend origins allowed to call the API from another domain. In production
// the API serves the store itself, which needs none, so only the Vite dev server is allowed by default.
// The public address of the store is always allowed
const defaultOrigins = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';

export const corsOrigins = [...(process.env.CORS_ORIGIN || defaultOrigins).split(','), publicSiteUrl]
  .map((origin) => origin.trim())
  .filter(Boolean);
