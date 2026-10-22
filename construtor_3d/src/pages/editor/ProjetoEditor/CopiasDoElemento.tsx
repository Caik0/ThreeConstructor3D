import CampoMedida from '../../../components/ui/CampoMedida/CampoMedida';
import {
  COPIAS_MAXIMO,
  COPIAS_PADRAO,
  MEDIDA_MAXIMA,
  MEDIDA_MINIMA,
  type ConfigCopias,
  type EixoCopias,
  type ModoCopias,
} from '../../../lib/projetos/projetos';
import { useEditorStore } from '../../../store/editorStore';
import styles from './ProjetoEditor.module.css';

const EIXOS: { valor: EixoCopias; rotulo: string }[] = [
  { valor: 'x', rotulo: 'Largura (X)' },
  { valor: 'y', rotulo: 'Profundidade (Y)' },
  { valor: 'z', rotulo: 'Altura (Z)' },
];

const MODOS: { valor: ModoCopias; rotulo: string }[] = [
  { valor: 'espacamento', rotulo: 'Um a cada…' },
  { valor: 'quantidade', rotulo: 'Quantidade fixa' },
];

// Repetição automática do elemento ao redimensionar o pai. O elemento
// é o modelo: a primeira cópia fica onde ele está, e a quantidade e a posição das outras no eixo
// seguem a regra a cada mudança de tamanho. Cada cópia é um elemento comum, ajustável à parte
export default function CopiasDoElemento({ chave }: { chave: string }) {
  const elemento = useEditorStore((s) => s.elementos[chave]);
  const totalDeCopias = useEditorStore(
    (s) =>
      Object.values(s.elementos).filter(
        (e) =>
          !!e.copiaDe &&
          e.copiaDe === s.elementos[chave]?.referenciaEstavel &&
          e.pai === s.elementos[chave]?.pai,
      ).length,
  );
  const nomeDoModelo = useEditorStore((s) => {
    const copia = s.elementos[chave];
    if (!copia?.copiaDe) return undefined;
    return Object.values(s.elementos).find(
      (e) => e.pai === copia.pai && !!e.copias && e.referenciaEstavel === copia.copiaDe,
    )?.nome;
  });
  const definirCopias = useEditorStore((s) => s.definirCopias);
  const recriarCopias = useEditorStore((s) => s.recriarCopias);

  const config = elemento?.copias;
  if (!elemento) return null;

  // Uma cópia só mostra de onde vem: a regra é configurada no modelo
  if (elemento.copiaDe) {
    return (
      <fieldset className={styles.grupo}>
        <legend className={styles.grupoTitulo}>Cópia automática</legend>
        <p className={styles.grupoInfo}>
          Cópia nº {elemento.indiceCopia} de “{nomeDoModelo ?? 'modelo'}”. A posição no eixo da repetição segue a
          regra do modelo; o resto (tamanho, medidas, textura…) é só desta cópia e pode ser ajustado à vontade.
          Para ter menos cópias, mude a regra no modelo.
        </p>
      </fieldset>
    );
  }

  const mudar = (parcial: Partial<ConfigCopias>) => config && definirCopias(chave, { ...config, ...parcial });

  return (
    <fieldset className={styles.grupo}>
      <legend className={styles.grupoTitulo}>Cópia Dinâmica</legend>
      <label>
        <input
          type="checkbox"
          checked={!!config}
          onChange={(e) => definirCopias(chave, e.target.checked ? COPIAS_PADRAO : null)}
        />{' '}
        Criar cópias deste elemento
      </label>

      {config && (
        <>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Direção</span>
            <select
              className={styles.input}
              value={config.eixo}
              onChange={(e) => mudar({ eixo: e.target.value as EixoCopias })}
            >
              {EIXOS.map((eixo) => (
                <option key={eixo.valor} value={eixo.valor}>
                  {eixo.rotulo}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Regra</span>
            <select
              className={styles.input}
              value={config.modo}
              onChange={(e) => mudar({ modo: e.target.value as ModoCopias })}
            >
              {MODOS.map((modo) => (
                <option key={modo.valor} value={modo.valor}>
                  {modo.rotulo}
                </option>
              ))}
            </select>
          </label>

          {config.modo === 'espacamento' ? (
            <CampoMedida
              rotulo="Espaçamento entre cópias"
              valor={config.espacamento}
              min={MEDIDA_MINIMA}
              max={MEDIDA_MAXIMA}
              onConfirmar={(espacamento) => mudar({ espacamento })}
            />
          ) : (
            <label className={styles.campo}>
              <span className={styles.rotulo}>Quantidade (1 a {COPIAS_MAXIMO})</span>
              <input
                className={styles.input}
                type="number"
                min={1}
                max={COPIAS_MAXIMO}
                step={1}
                value={config.quantidade}
                onChange={(e) => {
                  const quantidade = Math.round(Number(e.target.value));
                  if (Number.isFinite(quantidade) && quantidade >= 1 && quantidade <= COPIAS_MAXIMO) mudar({ quantidade });
                }}
              />
            </label>
          )}

          <CampoMedida
            rotulo="Margem até a borda do pai"
            valor={config.margemFim}
            min={0}
            max={MEDIDA_MAXIMA}
            onConfirmar={(margemFim) => mudar({ margemFim })}
          />

          <p className={styles.grupoInfo}>
            {totalDeCopias} {totalDeCopias + 1 === 1 ? 'cópia' : 'cópias'} no total.
          </p>
          <button
            type="button"
            className={styles.acao}
            disabled={totalDeCopias === 0}
            onClick={() => recriarCopias(chave)}
            title="Apaga as cópias e cria de novo a partir do modelo, descartando os ajustes de cada uma"
          >
            Recriar cópias a partir do modelo
          </button>
        </>
      )}
    </fieldset>
  );
}
