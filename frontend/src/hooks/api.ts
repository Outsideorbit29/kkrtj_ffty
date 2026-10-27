import { api } from '../api/client';
import type { Accuracy, Decision, HhMm, IsoDate, LeadTime, Meta } from '../api/types';
import { useApiResource, type Resource } from './useApiResource';

/**
 * Responses come from a fixed snapshot, so identical requests are shared across views (the
 * Overview, Accuracy and Explorer pages all read the same accuracy report). Failures are evicted
 * so Retry refetches. Requests are not aborted: another view may be waiting on the same promise.
 */
const cache = new Map<string, Promise<unknown>>();

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let hit = cache.get(key) as Promise<T> | undefined;
  if (!hit) {
    hit = load();
    cache.set(key, hit);
    hit.catch(() => cache.delete(key));
  }
  return hit;
}

function useCached<T>(key: string, load: () => Promise<T>): Resource<T> {
  return useApiResource(key, () => cached(key, load));
}

export const useMeta = (): Resource<Meta> => useCached('meta', () => api.meta());

export const useDecision = (deliveryDate: IsoDate, cutoff: HhMm): Resource<Decision> =>
  useCached(`decision|${deliveryDate}|${cutoff}`, () => api.decision(deliveryDate, cutoff));

export const useAccuracy = (start: IsoDate, end: IsoDate, cutoff: HhMm): Resource<Accuracy> =>
  useCached(`accuracy|${start}|${end}|${cutoff}`, () => api.accuracy(start, end, cutoff));

export const useLeadTime = (start: IsoDate, end: IsoDate): Resource<LeadTime> =>
  useCached(`lead-time|${start}|${end}`, () => api.leadTime(start, end));
