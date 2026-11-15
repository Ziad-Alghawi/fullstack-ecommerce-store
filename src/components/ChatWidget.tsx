import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router';
import { ButtonSpinner } from './PageStatus';
import { ChatIcon, CloseIcon } from './Icons';
import { Product } from './Product';
import { useChat } from '../hooks/useChat';
import { useI18n } from '../hooks/useI18n';
import type { LoadCart } from '../types/store';
import './ChatWidget.css';

interface ChatWidgetProps {
  loadCart: LoadCart;
}

// A floating button that opens a chat with the shopping assistant. Without a key on the server, it isn't there
export function ChatWidget({ loadCart }: ChatWidgetProps) {
  const [maxMessageLength, setMaxMessageLength] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const { messages, isPending, send } = useChat();
  const { t } = useI18n();
  const location = useLocation();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    axios.get<{ chat: boolean; maxMessageLength: number }>('/api/chat/config')
      .then(({ data }) => setMaxMessageLength(data.chat ? data.maxMessageLength : null))
      .catch(() => setMaxMessageLength(null));
  }, []);

  // A product's page would be hidden behind the chat, so going there closes it. The conversation stays
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, isPending]);

  if (!maxMessageLength) {
    return null;
  }

  const ask = async (question: string) => {
    setDraft('');
    // A question that wasn't answered goes back, so it can be sent again
    if (!await send(question)) {
      setDraft((current) => current || question);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (question && !isPending) {
      ask(question);
    }
  };

  const closeOnEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      toggleRef.current?.focus();
    }
  };

  return (
    <div className="chat" data-testid="chat">
      {isOpen && (
        <section className="chat-panel card" id="chat-panel" role="dialog" aria-label={t.chat.title}
          onKeyDown={closeOnEscape} data-testid="chat-panel">
          <header className="chat-header">
            <h2 className="chat-title">{t.chat.title}</h2>
            <button className="chat-close" aria-label={t.chat.close} onClick={() => {
              setIsOpen(false);
              toggleRef.current?.focus();
            }}>
              <CloseIcon width="20" height="20" />
            </button>
          </header>

          <div className="chat-log" ref={logRef} role="log" aria-label={t.chat.title} tabIndex={0}
            data-testid="chat-log">
            <p className="chat-message chat-message-assistant">{t.chat.greeting}</p>

            {messages.map((message, index) => (
              <div key={index} className={`chat-turn chat-turn-${message.role}`}>
                <p className={`chat-message chat-message-${message.role}`} data-testid={`chat-${message.role}-message`}>
                  <span className="visually-hidden">{t.chat.from[message.role]}: </span>
                  {message.content}
                </p>
                {message.products && message.products.length > 0 && (
                  <section className="chat-products" aria-label={t.chat.foundProducts}>
                    {message.products.map((product) => (
                      <Product key={product.id} product={product} loadCart={loadCart} headingLevel={3} lazyLoadImage />
                    ))}
                  </section>
                )}
              </div>
            ))}

            {isPending && (
              <p className="chat-typing" role="status" data-testid="chat-typing">
                <ButtonSpinner />
                {t.chat.typing}
              </p>
            )}

            {messages.length === 0 && (
              <div className="chat-suggestions" role="group" aria-label={t.chat.suggestionsLabel}>
                {t.chat.suggestions.map((suggestion) => (
                  <button key={suggestion} className="chat-suggestion" onClick={() => ask(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form className="chat-form" onSubmit={submit}>
            <label className="visually-hidden" htmlFor="chat-input">{t.chat.inputLabel}</label>
            <input id="chat-input" ref={inputRef} className="chat-input" type="text" autoComplete="off"
              maxLength={maxMessageLength} placeholder={t.chat.placeholder} value={draft}
              onChange={(event) => setDraft(event.target.value)} data-testid="chat-input" />
            <button className="chat-send button-primary" type="submit" disabled={isPending || !draft.trim()}
              data-testid="chat-send">
              {t.chat.send}
            </button>
          </form>
        </section>
      )}

      <button ref={toggleRef} className="chat-toggle button-primary" aria-expanded={isOpen} aria-controls="chat-panel"
        onClick={() => setIsOpen(!isOpen)} data-testid="chat-toggle">
        <ChatIcon width="20" height="20" />
        {t.chat.open}
      </button>
    </div>
  );
}
