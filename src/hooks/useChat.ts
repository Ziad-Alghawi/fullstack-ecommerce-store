import { useState } from 'react';
import axios from 'axios';
import { useI18n } from './useI18n';
import type { Product } from '../types/store';

// Only the last few messages are sent, which is all a shopping question needs
export const MAX_HISTORY = 6;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  // The products the assistant found, shown as cards under its answer
  products?: Product[];
}

// The conversation with the shopping assistant. A request the API refuses is reported by App, as for every
// button, so here it only takes the question back out of the conversation
export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isPending, setIsPending] = useState(false);
  const { language } = useI18n();

  // Whether the assistant answered
  const send = async (content: string) => {
    if (isPending) {
      return false;
    }
    const conversation: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(conversation);
    setIsPending(true);
    try {
      const { data } = await axios.post<{ reply: string; products: Product[] }>('/api/chat', {
        messages: conversation.slice(-MAX_HISTORY).map(({ role, content }) => ({ role, content })),
        language
      });
      setMessages([...conversation, { role: 'assistant', content: data.reply, products: data.products }]);
      return true;
    } catch {
      setMessages(messages);
      return false;
    } finally {
      setIsPending(false);
    }
  };

  return { messages, isPending, send };
}
