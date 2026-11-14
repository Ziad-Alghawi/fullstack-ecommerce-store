import { useEffect } from 'react';
import type { I18n } from '../i18n/i18n';

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isField(target: EventTarget | null): target is Field {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function describeProblem(field: Field, { t, formatNumber }: I18n) {
  const { validity } = field;
  const messages = t.validation;
  const limit = (value: string) => formatNumber(Number(value));

  if (validity.valueMissing) return messages.valueMissing;
  if (validity.typeMismatch) return field.type === 'email' ? messages.invalidEmail : '';
  if (validity.badInput) return messages.badInput;
  if (field instanceof HTMLSelectElement) return '';
  if (validity.tooShort) return messages.tooShort(field.minLength);
  if (field instanceof HTMLTextAreaElement) return '';
  if (validity.rangeUnderflow) return messages.rangeUnderflow(limit(field.min));
  if (validity.rangeOverflow) return messages.rangeOverflow(limit(field.max));
  if (validity.stepMismatch) return messages.stepMismatch;
  if (validity.patternMismatch) return field.title || messages.patternMismatch;
  return '';
}

// The browser explains a field filled in wrong in its own language, so the store
// replaces the message with one in the visitor's language
export function useValidationMessages(i18n: I18n) {
  useEffect(() => {
    const explain = ({ target }: Event) => {
      if (isField(target)) {
        target.setCustomValidity('');
        target.setCustomValidity(describeProblem(target, i18n));
      }
    };

    // The whole form, as checking one radio button fixes the others in its group
    const clear = ({ target }: Event) => {
      if (isField(target)) {
        for (const field of target.form?.elements ?? [target]) {
          if (isField(field)) {
            field.setCustomValidity('');
          }
        }
      }
    };

    document.addEventListener('invalid', explain, true);
    document.addEventListener('input', clear, true);
    document.addEventListener('change', clear, true);
    return () => {
      document.removeEventListener('invalid', explain, true);
      document.removeEventListener('input', clear, true);
      document.removeEventListener('change', clear, true);
    };
  }, [i18n]);
}
