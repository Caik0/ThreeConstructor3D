import styles from './Abas.module.css';

export interface Aba<T extends string> {
  id: T;
  rotulo: string;
}

interface AbasProps<T extends string> {
  abas: Aba<T>[];
  valor: T;
  onChange: (id: T) => void;
  /** Nome da lista de abas para leitores de tela (ex.: "Cadastros por tipo") */
  rotulo: string;
}

/** Abas de uma tela: quem usa mostra o conteúdo da aba escolhida (um `role="tabpanel"` com o
 * `aria-labelledby` do botão, `abaId(id)`); as setas do teclado trocam de aba */
export const abaId = (id: string) => `aba-${id}`;

export default function Abas<T extends string>({ abas, valor, onChange, rotulo }: AbasProps<T>) {
  function aoTeclar(e: React.KeyboardEvent, indice: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const proxima = abas[(indice + (e.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
    onChange(proxima.id);
    document.getElementById(abaId(proxima.id))?.focus();
  }

  return (
    <div className={styles.abas} role="tablist" aria-label={rotulo}>
      {abas.map((aba, indice) => (
        <button
          key={aba.id}
          id={abaId(aba.id)}
          type="button"
          role="tab"
          aria-selected={valor === aba.id}
          tabIndex={valor === aba.id ? 0 : -1}
          className={styles.aba}
          onClick={() => onChange(aba.id)}
          onKeyDown={(e) => aoTeclar(e, indice)}
        >
          {aba.rotulo}
        </button>
      ))}
    </div>
  );
}
