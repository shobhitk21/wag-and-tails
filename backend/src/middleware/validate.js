import { httpError } from './error.js';

/* Validates req.body against a zod schema and replaces it with the parsed
   result, so handlers get typed, trimmed values rather than raw input. */
export const validate = (schema) => (req, _res, next) => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return next(httpError(400, 'Check the highlighted fields.', parsed.error.flatten().fieldErrors));
  }
  req.body = parsed.data;
  next();
};
