import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ParamsDictionary } from 'express-serve-static-core';

// Express 4 doesn't catch a rejected promise from a route, so a failed database
// call would crash the server instead of reaching the error handler
// Generic over the route's params, so req.params knows the names in the path
export function asyncHandler<P = ParamsDictionary>(
  handler: (req: Request<P>, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler<P> {
  return (req, res, next) => handler(req, res, next).catch(next);
}
