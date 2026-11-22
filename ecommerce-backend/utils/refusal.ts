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
// A refusal with the HTTP status to send it with. Errors only a developer meets may leave out the code
export type HttpRefusal = Omit<Refusal, 'code'> & { code?: string; status: number };

export function sendRefusal(res: Response, { status, ...body }: HttpRefusal) {
  return res.status(status).json(body);
}
