import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'node:crypto';

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public retryable = false) {
    super(message);
  }
}

// Stable database error codes (raised by the SQL functions) mapped to customer-facing messages.
const DB_ERRORS: Record<string, [number, string]> = {
  DS_BAD_QUANTITY: [400, 'Choose how many tickets you want.'],
  DS_TICKET_TYPE_NOT_FOUND: [404, 'That ticket is no longer available.'],
  DS_NOT_ON_SALE: [409, 'Tickets for this event are not on sale right now.'],
  DS_SALES_CLOSED: [409, 'Sales for this event have closed.'],
  DS_MEMBERSHIP_REQUIRED: [402, 'Tickets are for Doorstep members. Join to book.'],
  DS_AFFILIATE_INVALID: [403, 'This link is not valid for this event any more.'],
  DS_TOO_MANY: [400, 'That is more tickets than one order allows.'],
  DS_SOLD_OUT: [409, 'Sorry, there are not enough tickets left.'],
  DS_ORDER_NOT_FOUND: [404, 'Order not found.'],
  DS_REFUND_TOO_LARGE: [400, 'The refund is larger than the amount paid.'],
};

export function fromDbError(err: { message?: string } | null | undefined): HttpError {
  const msg = err?.message ?? '';
  const code = Object.keys(DB_ERRORS).find((k) => msg.includes(k));
  if (code) {
    const [status, text] = DB_ERRORS[code];
    return new HttpError(status, code.replace(/^DS_/, ''), text);
  }
  return new HttpError(500, 'INTERNAL', 'Something went wrong. Please try again.', true);
}

type Handler = (req: VercelRequest, res: VercelResponse, ctx: { requestId: string }) => Promise<unknown>;

/** Wraps a Vercel function: method check, request id, consistent JSON errors, no secret leakage. */
export function handler(methods: string[], fn: Handler) {
  return async (req: VercelRequest, res: VercelResponse) => {
    const requestId = (req.headers['x-vercel-id'] as string) || randomUUID();
    res.setHeader('x-request-id', requestId);
    res.setHeader('cache-control', 'no-store');
    if (!methods.includes(req.method ?? '')) {
      res.setHeader('allow', methods.join(', '));
      return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', request_id: requestId } });
    }
    try {
      const out = await fn(req, res, { requestId });
      if (!res.headersSent && out !== undefined) res.status(200).json(out);
    } catch (e) {
      const err = e instanceof HttpError ? e : new HttpError(500, 'INTERNAL', 'Something went wrong. Please try again.', true);
      if (!(e instanceof HttpError) || err.status >= 500) console.error(`[${requestId}]`, e);
      if (!res.headersSent) {
        res.status(err.status).json({ error: { code: err.code, message: err.message, retryable: err.retryable, request_id: requestId } });
      }
    }
  };
}

export function bodyOf<T>(req: VercelRequest, parse: (v: unknown) => T): T {
  try {
    return parse(typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {});
  } catch {
    throw new HttpError(400, 'VALIDATION', 'The request was not valid.');
  }
}

/** Reads the raw body (needed for webhook signature checks). Requires bodyParser: false. */
export async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}
