// A reason a shopper can run into comes with a code and the values in it, so the store can say it in the
// visitor's language. The English message stays for everything else that reads the API
export function refusal(code, error, params) {
  return { error, code, ...(params && { params }) };
}

// For refusals that carry their HTTP status
export function sendRefusal(res, { status, ...body }) {
  return res.status(status).json(body);
}
