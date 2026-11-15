import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { chatAddressLimit, chatVisitorLimit } from '../middleware/rateLimits.js';
import { requireVisitor } from '../middleware/visitor.js';
import { anthropic } from '../utils/anthropic.js';
import { answerChat, LANGUAGE_NAMES } from '../utils/chatAssistant.js';
import { refusal, sendRefusal } from '../utils/refusal.js';

const router = express.Router();

const MAX_MESSAGE_LENGTH = 500;
// Only the last few messages are sent on, which is all a shopping question needs
const MAX_HISTORY = 6;
// Messages the assistant answers in a day, for the whole store, so a flood can't run up the bill
const DAILY_LIMIT = Number(process.env.CHAT_DAILY_LIMIT) || 300;

let today = '';
let answeredToday = 0;

// Counts one more answer, or says the day's limit is reached
function takeFromDailyLimit() {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== today) {
    today = day;
    answeredToday = 0;
  }
  if (answeredToday >= DAILY_LIMIT) {
    return false;
  }
  answeredToday++;
  return true;
}

// The messages to send on, or the rejection to answer with. Whatever the browser sends is untrusted
function readMessages(messages) {
  const isValid = Array.isArray(messages) && messages.length > 0 && messages.every((message) => (
    ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string' && message.content.trim()
  ));
  if (!isValid || messages.at(-1).role !== 'user') {
    return { rejection: { status: 400, error: 'Send the conversation as a list of messages that ends with a user message' } };
  }

  const recent = messages.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content: content.trim() }));
  // A conversation has to start with the visitor
  const start = recent.findIndex(({ role }) => role === 'user');
  const history = recent.slice(start);
  if (history.some(({ content }) => content.length > MAX_MESSAGE_LENGTH)) {
    return {
      rejection: {
        status: 400,
        ...refusal('chatMessageTooLong', `Messages can be up to ${MAX_MESSAGE_LENGTH} characters long`, { max: MAX_MESSAGE_LENGTH })
      }
    };
  }
  return { history };
}

function requireChat(req, res, next) {
  if (!anthropic) {
    return sendRefusal(res, { status: 404, ...refusal('chatDisabled', 'The shopping assistant is not available') });
  }
  next();
}

// The frontend only shows the chat button when this says yes
router.get('/config', (req, res) => {
  res.json({ chat: Boolean(anthropic), maxMessageLength: MAX_MESSAGE_LENGTH });
});

router.post('/', requireChat, chatAddressLimit, requireVisitor, chatVisitorLimit, asyncHandler(async (req, res) => {
  const { messages, language = 'en' } = req.body;
  if (!Object.hasOwn(LANGUAGE_NAMES, language)) {
    return res.status(400).json({ error: `Language must be one of: ${Object.keys(LANGUAGE_NAMES).join(', ')}` });
  }
  const { history, rejection } = readMessages(messages);
  if (rejection) {
    return sendRefusal(res, rejection);
  }
  if (!takeFromDailyLimit()) {
    return sendRefusal(res, {
      status: 429, ...refusal('chatBusy', 'The assistant has answered a lot of questions today. Please try again tomorrow.')
    });
  }

  try {
    const { reply, products } = await answerChat(history, language);
    if (reply) {
      return res.json({ reply, products });
    }
  } catch (error) {
    // Only what went wrong, never what the visitor wrote
    console.error('The shopping assistant failed:', error.status ?? error.name, error.message);
  }
  sendRefusal(res, { status: 502, ...refusal('chatUnavailable', "The assistant couldn't answer. Please try again.") });
}));

export default router;
