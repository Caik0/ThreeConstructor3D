import { useAuthStore } from '../../store/authStore';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Usa as mensagens de validação do ASP.NET (ProblemDetails) quando houver
async function mensagemDeErro(response: Response, method: string, path: string) {
  try {
    const problema = (await response.json()) as {
      title?: string;
      errors?: Record<string, string[]>;
    };
    const erros = Object.values(problema.errors ?? {}).flat();
    if (erros.length > 0) return erros.join(' ');
    if (problema.title) return problema.title;
  } catch {
    // corpo vazio ou não-JSON
  }
  return `${method} ${path} falhou com HTTP ${response.status}`;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  // FormData vai como multipart (ver apiPostForm): o navegador é quem define o Content-Type
  // (com o boundary), então não pode ser definido à mão aqui, e o corpo vai direto, sem stringify
  const isForm = body instanceof FormData;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = useAuthStore.getState().token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (!response.ok) {
    // Token ausente/expirado/inválido: limpa a sessão salva, pra a tela seguinte já pedir login
    // de novo em vez de continuar achando que o usuário está autenticado
    if (response.status === 401 && token) useAuthStore.getState().logout();
    throw new ApiError(response.status, await mensagemDeErro(response, method, path));
  }

  // 204 No Content: não há corpo para ler
  if (response.status === 204) return undefined as T;

  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string) {
  return request<T>('GET', path);
}

export function apiPost<T>(path: string, body: unknown) {
  return request<T>('POST', path, body);
}

/** Como apiPost, mas envia um FormData (multipart) — pra arquivo grande, onde base64 dentro de
 * JSON obrigaria montar o arquivo inteiro (+ ~33%) em memória antes de enviar */
export function apiPostForm<T>(path: string, form: FormData) {
  return request<T>('POST', path, form);
}

export function apiPut<T>(path: string, body: unknown) {
  return request<T>('PUT', path, body);
}

export function apiDelete(path: string) {
  return request<void>('DELETE', path);
}
