import { useEffect, useState, type FormEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useAction } from './useAction';
import { useI18n } from './useI18n';
import { loadSupabase } from '../utils/supabase';

type AuthRequest = (supabase: SupabaseClient) => Promise<{ error: { message: string; code?: string } | null }>;

// Submits a login, sign up or password form to Supabase, and keeps the error to show with the form
export function useAuthRequest(request: AuthRequest) {
  const [error, setError] = useState<string | null>(null);
  const { t, authError } = useI18n();

  // Start downloading Supabase while the user types
  useEffect(() => {
    loadSupabase().catch(() => {});
  }, []);

  const [submit, isPending] = useAction(async () => {
    setError(null);
    const supabase = await loadSupabase().catch(() => null);
    if (!supabase) {
      setError(t.login.unreachable);
      return;
    }
    const { error } = await request(supabase);
    setError(error && authError(error));
  });

  const submitForm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit();
  };

  return { submitForm, isPending, error, clearError: () => setError(null) };
}
