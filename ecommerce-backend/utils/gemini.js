import { GoogleGenAI } from '@google/genai';

// GEMINI_API_URL is only for tests, which point the client at a local stand-in for the Gemini API
const baseUrl = process.env.GEMINI_API_URL;

// Without a key, the shopping assistant is off and the store works as before. One attempt per
// request, as the SDK retries 5 times by default and the assistant has its own timeout
export const gemini = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { ...(baseUrl && { baseUrl }), retryOptions: { attempts: 1 } } })
  : null;

// A fast, cheap model that supports function calling and thinking levels
export const CHAT_MODEL = process.env.CHAT_MODEL || 'gemini-3.8-flash';
