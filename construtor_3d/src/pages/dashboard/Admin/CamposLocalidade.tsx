import type { Opcao } from '../../../lib/localidades/localidades';
import styles from './AdminUsuarios.module.css';

// Campos de país, estado e cidade usados nos formulários de Empresas e de Usuários

/** Lista de opções vinda das APIs de localidades; se a consulta falhar, vira texto livre para não travar o cadastro */
export function CampoLocalidade(props: {
  rotulo: string;
  valor: string | null;
  opcoes: Opcao[] | undefined;
  carregando: boolean;
  falhou: boolean;
  desabilitado: boolean;
  tamanho: number;
  onChange: (valor: string) => void;
}) {
  const { rotulo, valor, opcoes, carregando, falhou, desabilitado, tamanho, onChange } = props;
  const lista = !falhou && opcoes && opcoes.length > 0;
  return (
    <label className={styles.campo}>
      <span className={styles.rotuloCampo}>{rotulo}</span>
      {lista ? (
        <select className={styles.input} value={valor ?? ''} disabled={desabilitado} onChange={(e) => onChange(e.target.value)}>
          <option value="">{carregando ? 'Carregando…' : 'Selecione'}</option>
          {/* valor antigo que não está na lista continua visível, em vez de sumir ao editar */}
          {valor && !opcoes.some((o) => o.valor === valor) && <option value={valor}>{valor}</option>}
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.rotulo}
            </option>
          ))}
        </select>
      ) : (
        <input
          className={styles.input}
          value={valor ?? ''}
          maxLength={tamanho}
          disabled={desabilitado}
          placeholder={carregando ? 'Carregando…' : falhou ? 'Lista indisponível: digite' : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

/** Seletor de país: se a lista não carregar, aceita o código ISO digitado */
export function PaisSelect({ valor, opcoes, carregando, falhou, onChange }: { valor: string | null; opcoes: Opcao[] | undefined; carregando: boolean; falhou: boolean; onChange: (codigo: string) => void }) {
  if (falhou || !opcoes) {
    return (
      <input
        className={styles.input}
        value={valor ?? ''}
        maxLength={2}
        placeholder={carregando ? 'Carregando…' : 'Código do país (ex.: BR)'}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
    );
  }
  return (
    <select className={styles.input} value={valor ?? ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">Selecione</option>
      {valor && !opcoes.some((o) => o.valor === valor) && <option value={valor}>{valor}</option>}
      {opcoes.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}
