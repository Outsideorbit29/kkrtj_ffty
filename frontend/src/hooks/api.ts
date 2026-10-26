import { api } from '../api/client';
import type { Accuracy, Decision, HhMm, IsoDate, LeadTime, Meta } from '../api/types';
import { useApiResource, type Resource } from './useApiResource';

export const useMeta = (): Resource<Meta> => useApiResource('meta', (signal) => api.meta(signal));

export const useDecision = (deliveryDate: IsoDate, cutoff: HhMm): Resource<Decision> =>
  useApiResource(`decision|${deliveryDate}|${cutoff}`, (signal) => api.decision(deliveryDate, cutoff, signal));

export const useAccuracy = (start: IsoDate, end: IsoDate, cutoff: HhMm): Resource<Accuracy> =>
  useApiResource(`accuracy|${start}|${end}|${cutoff}`, (signal) => api.accuracy(start, end, cutoff, signal));

export const useLeadTime = (start: IsoDate, end: IsoDate): Resource<LeadTime> =>
  useApiResource(`lead-time|${start}|${end}`, (signal) => api.leadTime(start, end, signal));
