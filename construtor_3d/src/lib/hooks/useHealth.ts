import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api/health';

export const HEALTH_REFRESH_MS = 10_000;

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: HEALTH_REFRESH_MS,
    retry: false,
  });
}
