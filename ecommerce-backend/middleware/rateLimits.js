import { rateLimit } from 'express-rate-limit';
import { refusal } from '../utils/refusal.ts';

const WINDOW_MS = 15 * 60 * 1000;
// RATE_LIMIT_SCALE multiplies every limit, for example so the API tests can make many requests
const scale = Number(process.env.RATE_LIMIT_SCALE) || 1;

// Requests per IP address in 15 minutes. Counts are kept in memory, as the store runs on one server
export function limitTo(limit, options = {}) {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit: limit * scale,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: refusal('tooManyRequests', 'Too many requests. Please wait a few minutes and try again.'),
    ...options
  });
}

// Every API request, so no one can keep the shared database busy
export const apiLimit = limitTo(1000);
// Checks login tokens. Logging in, signing up and password emails go to Supabase, which limits them itself
export const authLimit = limitTo(100);
export const reviewLimit = limitTo(20);
// Placing, paying for and cancelling orders
export const checkoutLimit = limitTo(30);
// The shopping assistant costs money per message, so it has limits of its own: per address, and per
// visitor or user, as an address may be shared. requireVisitor has to come before the second
export const chatAddressLimit = limitTo(30);
export const chatVisitorLimit = limitTo(15, { keyGenerator: (req) => req.visitorId });
