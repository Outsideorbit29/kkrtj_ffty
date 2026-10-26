import type { Accuracy, Decision, HhMm, IsoDate, LeadTime, Meta } from './types';

const API_BASE: string = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

/** Error raised for non-2xx responses and network failures. `status` is 0 for network errors. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type Query = Record<string, string | undefined>;

function buildUrl(path: string, query: Query = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return `${API_BASE}${path}${qs ? `?${qs}` : ''}`;
}

/** FastAPI returns `{"detail": "..."}` (string) or a list of validation errors. */
async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'detail' in body) {
      const { detail } = body as { detail: unknown };
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((d: unknown) => (d && typeof d === 'object' && 'msg' in d ? String(d.msg) : String(d)))
          .join('; ');
      }
    }
  } catch {
    // Non-JSON error body; fall through to the status text.
  }
  return response.statusText || `Request failed with status ${response.status}`;
}

async function getJson<T>(path: string, query: Query, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), { signal, headers: { Accept: 'application/json' } });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Could not reach the forecast service. Check your connection and try again.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorDetail(response));
  }
  return (await response.json()) as T;
}

export const api = {
  meta: (signal?: AbortSignal) => getJson<Meta>('/api/meta', {}, signal),

  /** `date` is the delivery day D; the decision is taken on D-1 at `cutoff`. */
  decision: (date: IsoDate, cutoff: HhMm, signal?: AbortSignal) =>
    getJson<Decision>('/api/decision', { date, cutoff }, signal),

  accuracy: (start: IsoDate, end: IsoDate, cutoff: HhMm, signal?: AbortSignal) =>
    getJson<Accuracy>('/api/accuracy', { start, end, cutoff }, signal),

  leadTime: (start: IsoDate, end: IsoDate, signal?: AbortSignal) =>
    getJson<LeadTime>('/api/accuracy/lead-time', { start, end }, signal),
};
