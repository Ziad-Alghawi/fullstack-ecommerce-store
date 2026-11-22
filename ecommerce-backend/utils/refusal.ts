import type { Response } from 'express';

// A reason a shopper can run into comes with a code and the values in it, so the store can say it in the
// visitor's language. The English message stays for everything else that reads the API
export type RefusalParams = Record<string, string | number>;

export interface Refusal {
  error: string;
  code: string;
  params?: RefusalParams;
}

export function refusal(code: string, error: string, params?: RefusalParams): Refusal {
  return { error, code, ...(params && { params }) };
}

// For refusals that carry their HTTP status
export function sendRefusal(res: Response, { status, ...body }: Refusal & { status: number }) {
  return res.status(status).json(body);
}
