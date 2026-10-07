// Resposta de GET /api/health (HealthController)
export interface HealthResponse {
  api: string;
  database: boolean;
}

export interface HealthCheck extends HealthResponse {
  latencyMs: number;
}
