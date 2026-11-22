import type { NextFunction, Request, Response } from 'express';
import { publicSiteUrl } from '../utils/publicSiteUrl.ts';

// Render also serves the store on an address of its own, which it names in RENDER_EXTERNAL_HOSTNAME.
// Everything asked there moves to the public address, so the store has one address to link to and index
const renderHost = process.env.RENDER_EXTERNAL_HOSTNAME?.toLowerCase();
const isRedirecting = Boolean(publicSiteUrl && renderHost && renderHost !== URL.parse(publicSiteUrl)?.hostname);

export function redirectToPublicSite(req: Request, res: Response, next: NextFunction) {
  // Stripe doesn't follow redirects, so its events keep coming to the old address too
  const isWebhook = req.method === 'POST' && req.path === '/api/stripe/webhook';
  if (isRedirecting && req.hostname === renderHost && !isWebhook) {
    return res.redirect(301, `${publicSiteUrl}${req.originalUrl}`);
  }
  next();
}
