import { API_BASE_URL, ApiError } from '../../../lib/api/client';
import { HEALTH_REFRESH_MS, useHealth } from '../../../lib/hooks/useHealth';
import styles from './Status.module.css';

type State = 'ok' | 'error' | 'pending' | 'unknown';

const STATE_LABEL: Record<State, string> = {
  ok: 'Conectado',
  error: 'Falhou',
  pending: 'Verificando…',
  unknown: 'Sem informação',
};

const DB_DETAIL: Record<State, string> = {
  ok: 'Consulta de teste ok',
  error: 'A API não conseguiu conectar',
  pending: 'Aguardando resposta',
  unknown: 'Depende da API responder',
};

interface StatusNodeProps {
  title: string;
  subtitle: string;
  state: State;
  detail: string;
}

function StatusNode({ title, subtitle, state, detail }: StatusNodeProps) {
  return (
    <div className={`${styles.node} ${styles[state]}`}>
      <span className={styles.dot} aria-hidden="true" />
      <strong className={styles.title}>{title}</strong>
      <span className={styles.subtitle}>{subtitle}</span>
      <span className={styles.badge}>{STATE_LABEL[state]}</span>
      <span className={styles.detail}>{detail}</span>
    </div>
  );
}

function Connector({ state }: { state: State }) {
  return <div className={`${styles.connector} ${styles[state]}`} aria-hidden="true" />;
}

function describeError(error: Error) {
  if (error instanceof ApiError) return `API respondeu HTTP ${error.status}`;
  return 'Sem resposta (rede ou proxy)';
}

export default function Status() {
  const { data, error, isPending, isError, isFetching, refetch, dataUpdatedAt, errorUpdatedAt } =
    useHealth();

  const apiState: State = isPending ? 'pending' : isError ? 'error' : 'ok';
  const dbState: State = isPending
    ? 'pending'
    : isError
      ? 'unknown'
      : data?.database
        ? 'ok'
        : 'error';

  const summary: { state: State; text: string } =
    apiState === 'pending'
      ? { state: 'pending', text: 'Verificando conexões…' }
      : apiState === 'error'
        ? { state: 'error', text: 'O front não conseguiu falar com a API' }
        : dbState === 'error'
          ? { state: 'error', text: 'A API está no ar, mas não conecta no banco' }
          : { state: 'ok', text: 'Tudo conectado' };

  const apiDetail =
    isError && error
      ? describeError(error)
      : data
        ? `${data.latencyMs} ms de ida e volta`
        : 'Aguardando resposta';

  const lastCheck = Math.max(dataUpdatedAt, errorUpdatedAt);
  const lastCheckLabel = lastCheck ? new Date(lastCheck).toLocaleTimeString('pt-BR') : '—';

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <h1>Status das conexões</h1>
        <p className={`${styles.summary} ${styles[summary.state]}`} role="status">
          {summary.text}
        </p>
      </header>

      <div className={styles.flow}>
        <StatusNode
          title="Front-end"
          subtitle={window.location.host}
          state="ok"
          detail="React carregado neste navegador"
        />
        <Connector state={apiState} />
        <StatusNode
          title="API"
          subtitle={`GET ${API_BASE_URL}/health`}
          state={apiState}
          detail={apiDetail}
        />
        <Connector state={dbState} />
        <StatusNode
          title="Banco de dados"
          subtitle="SQL Server"
          state={dbState}
          detail={DB_DETAIL[dbState]}
        />
      </div>

      <footer className={styles.footer}>
        <span>
          Última verificação: {lastCheckLabel} · atualiza a cada {HEALTH_REFRESH_MS / 1000} s
        </span>
        <button
          type="button"
          className={styles.button}
          onClick={() => refetch()}
          disabled={isFetching}
        >
          {isFetching ? 'Verificando…' : 'Verificar agora'}
        </button>
      </footer>

      <details className={styles.raw}>
        <summary>Resposta bruta</summary>
        <pre>{isError ? error?.message : JSON.stringify(data ?? null, null, 2)}</pre>
      </details>
    </section>
  );
}
