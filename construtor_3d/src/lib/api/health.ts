import { apiGet } from './client';
import type { HealthCheck, HealthResponse } from './types';

export async function getHealth(): Promise<HealthCheck> {
  const start = performance.now();
  const data = await apiGet<HealthResponse>('/health');

  return {
    ...data,
    latencyMs: Math.round(performance.now() - start),
  };
}
