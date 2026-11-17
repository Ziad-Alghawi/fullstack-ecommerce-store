import { it, expect, describe, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { LoadingMessage } from './PageStatus';

describe('LoadingMessage', () => {
  it('explains the wait when loading is slow', () => {
    vi.useFakeTimers();
    render(<LoadingMessage />);

    expect(screen.queryByTestId('slow-loading-message')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.getByTestId('slow-loading-message'))
      .toHaveTextContent('The demo server is waking up');
    vi.useRealTimers();
  });
});
