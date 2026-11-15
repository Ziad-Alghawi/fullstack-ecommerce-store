import { it, expect, describe, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router';
import axios from 'axios';
import { ChatWidget } from './ChatWidget';
import { I18nContext } from '../hooks/useI18n';
import { ToastContext } from '../hooks/useToast';
import { createI18n } from '../i18n/i18n';
import type { Product } from '../types/store';

vi.mock('axios');

const socks: Product = {
  id: 'e43638ce-6aa0-4b85-b27f-e1d07eb678c6',
  image: 'images/products/gray-hand-knit-wool-socks.jpg',
  name: 'Gray Hand Knit Wool Socks',
  rating: { stars: 4.5, count: 87 },
  priceCents: 1090,
  stock: 20
};

describe('ChatWidget', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let loadCart: ReturnType<typeof vi.fn>;
  let answers: unknown[];

  const renderWidget = (language: 'en' | 'de' = 'en') => render(
    <MemoryRouter>
      <I18nContext value={{ ...createI18n(language), setLanguage: vi.fn() }}>
        <ToastContext value={vi.fn()}>
          <ChatWidget loadCart={loadCart} />
          <Link to="/checkout">Go to checkout</Link>
        </ToastContext>
      </I18nContext>
    </MemoryRouter>
  );

  const openChat = async () => {
    await user.click(await screen.findByTestId('chat-toggle'));
    return screen.getByTestId('chat-panel');
  };

  const sentMessages = (call = 0) => (vi.mocked(axios.post).mock.calls[call][1] as { messages: unknown[]; language: string });

  beforeEach(() => {
    vi.resetAllMocks();
    user = userEvent.setup();
    loadCart = vi.fn(async () => {});
    answers = [{ data: { reply: 'These socks cost €10.90.', products: [socks] } }];
    vi.mocked(axios.get).mockResolvedValue({ data: { chat: true, maxMessageLength: 500 } });
    vi.mocked(axios.post).mockImplementation(async (url) => (
      url === '/api/chat' ? answers.shift() ?? { data: { reply: 'Happy to help.', products: [] } } : { data: '' }
    ));
  });

  it('is not shown when the server has the assistant turned off, or cannot be reached', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { chat: false, maxMessageLength: 500 } });
    const { unmount } = renderWidget();
    await waitFor(() => expect(axios.get).toHaveBeenCalledWith('/api/chat/config'));
    expect(screen.queryByTestId('chat-toggle')).not.toBeInTheDocument();
    unmount();

    vi.mocked(axios.get).mockRejectedValue(new Error('Network Error'));
    renderWidget();
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('chat-toggle')).not.toBeInTheDocument();
  });

  it('opens from the button with the focus in the message field, and closes with Escape, back to the button', async () => {
    renderWidget();
    const toggle = await screen.findByRole('button', { name: 'Ask our assistant' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    const panel = screen.getByRole('dialog', { name: 'Shopping assistant' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(panel).getByText(/I'm the store's assistant/)).toBeInTheDocument();
    expect(screen.getByLabelText('Your message')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Close the assistant' }));
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
  });

  it('sends the question in the UI language and shows the answer with product cards', async () => {
    renderWidget();
    await openChat();

    expect(screen.getByTestId('chat-send')).toBeDisabled();
    await user.type(screen.getByTestId('chat-input'), 'Do you have socks?{Enter}');

    expect(axios.post).toHaveBeenCalledWith('/api/chat', { messages: [{ role: 'user', content: 'Do you have socks?' }], language: 'en' });
    expect(await screen.findByTestId('chat-assistant-message')).toHaveTextContent('These socks cost €10.90.');
    expect(screen.getByTestId('chat-user-message')).toHaveTextContent('Do you have socks?');
    expect(screen.getByTestId('chat-input')).toHaveValue('');

    // The card is the shop's own, with a link to the product and Add to Cart
    const card = within(screen.getByRole('region', { name: 'Products the assistant found' })).getByTestId('product-container');
    expect(within(card).getByRole('link', { name: 'Gray Hand Knit Wool Socks' })).toHaveAttribute('href', `/products/${socks.id}`);
    expect(within(card).getByText('€10.90')).toBeInTheDocument();
    await user.click(within(card).getByTestId('add-to-cart-button'));
    expect(axios.post).toHaveBeenCalledWith('/api/cart-items', { productId: socks.id, quantity: 1 });
    await waitFor(() => expect(loadCart).toHaveBeenCalled());
  });

  it('writes in German with a German UI, and sends that language', async () => {
    renderWidget('de');
    await user.click(await screen.findByRole('button', { name: 'Assistent fragen' }));
    expect(screen.getByRole('dialog', { name: 'Einkaufsassistent' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Wie funktioniert der Versand?' }));
    expect(sentMessages().language).toBe('de');
    expect(sentMessages().messages).toEqual([{ role: 'user', content: 'Wie funktioniert der Versand?' }]);
    expect(await screen.findByText('Du:')).toBeInTheDocument();
  });

  it('sends only the last 6 messages', async () => {
    renderWidget();
    await openChat();

    for (const question of ['One', 'Two', 'Three', 'Four']) {
      await user.type(screen.getByTestId('chat-input'), `${question}{Enter}`);
      await waitFor(() => expect(screen.queryByTestId('chat-typing')).not.toBeInTheDocument());
    }

    // Seven messages by now, so the first question is left out
    const lastRequest = sentMessages(3).messages as { role: string; content: string }[];
    expect(lastRequest.map(({ content }) => content)).toEqual([
      'These socks cost €10.90.', 'Two', 'Happy to help.', 'Three', 'Happy to help.', 'Four'
    ]);
    expect(lastRequest.at(-1)).toEqual({ role: 'user', content: 'Four' });
  });

  it('takes a question back when it was not answered, so it can be sent again', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('Request failed'));
    renderWidget();
    await openChat();

    await user.type(screen.getByTestId('chat-input'), 'Hello?{Enter}');

    await waitFor(() => expect(screen.getByTestId('chat-input')).toHaveValue('Hello?'));
    expect(screen.queryByTestId('chat-user-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('chat-typing')).not.toBeInTheDocument();
  });

  it('shows that the assistant is typing, and does not send a second question meanwhile', async () => {
    let answer: (value: unknown) => void = () => {};
    vi.mocked(axios.post).mockReturnValue(new Promise((resolve) => { answer = resolve; }));
    renderWidget();
    await openChat();

    await user.type(screen.getByTestId('chat-input'), 'First{Enter}');
    expect(await screen.findByTestId('chat-typing')).toHaveTextContent('The assistant is typing…');
    await user.type(screen.getByTestId('chat-input'), 'Second{Enter}');
    expect(axios.post).toHaveBeenCalledTimes(1);

    answer({ data: { reply: 'Done', products: [] } });
    await waitFor(() => expect(screen.queryByTestId('chat-typing')).not.toBeInTheDocument());
  });

  it('limits the message to what the server accepts', async () => {
    vi.mocked(axios.get).mockResolvedValue({ data: { chat: true, maxMessageLength: 120 } });
    renderWidget();
    await openChat();

    expect(screen.getByTestId('chat-input')).toHaveAttribute('maxlength', '120');
  });

  it('closes when the visitor goes to another page, and keeps the conversation', async () => {
    renderWidget();
    await openChat();
    await user.type(screen.getByTestId('chat-input'), 'Hi{Enter}');
    await screen.findByTestId('chat-assistant-message');

    await user.click(screen.getByRole('link', { name: 'Go to checkout' }));
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();

    await openChat();
    expect(screen.getByTestId('chat-user-message')).toHaveTextContent('Hi');
  });
});
