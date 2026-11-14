import { it, expect, describe } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useValidationMessages } from './useValidationMessages';
import { createI18n } from '../i18n/i18n';

const german = createI18n('de');

function Form() {
  useValidationMessages(german);

  return (
    <form data-testid="form">
      <input aria-label="Email" type="email" required />
      <input aria-label="Percent" type="number" min="1" max="90" defaultValue="95" />
      <input aria-label="Code" type="text" pattern="[A-Z]{3}" title="3 Großbuchstaben" defaultValue="ab" />
      <input aria-label="One star" type="radio" name="stars" value="1" required />
      <input aria-label="Two stars" type="radio" name="stars" value="2" required />
    </form>
  );
}

describe('useValidationMessages', () => {
  it("explains each problem in the visitor's language", () => {
    render(<Form />);

    expect((screen.getByTestId('form') as HTMLFormElement).checkValidity()).toBe(false);

    expect(screen.getByLabelText<HTMLInputElement>('Email').validationMessage).toBe('Bitte fülle dieses Feld aus.');
    expect(screen.getByLabelText<HTMLInputElement>('Percent').validationMessage).toBe('Bitte gib höchstens 90 ein.');
    expect(screen.getByLabelText<HTMLInputElement>('Code').validationMessage).toBe('3 Großbuchstaben');
  });

  it('lets a fixed field through again, including the rest of a radio group', async () => {
    const user = userEvent.setup();
    render(<Form />);
    (screen.getByTestId('form') as HTMLFormElement).checkValidity();

    await user.type(screen.getByLabelText('Email'), 'ziad@example.com');
    await user.click(screen.getByLabelText('Two stars'));

    expect(screen.getByLabelText<HTMLInputElement>('Email').validity.valid).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('One star').validity.valid).toBe(true);
    expect(screen.getByLabelText<HTMLInputElement>('Two stars').validity.valid).toBe(true);
  });
});
