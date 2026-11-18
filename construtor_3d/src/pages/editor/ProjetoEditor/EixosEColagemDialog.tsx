import { useId, useMemo, useState } from 'react';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import { COLAGENS, NOME_COLAGEM, type ColagemElemento, type Posicao } from '../../../lib/projetos/projetos';
import {
  EIXOS_PADRAO,
  NOMES_DIRECAO,
  cantoDaOrigem,
  direcaoZ,
  eixosDaRotacao,
  mesmaDirecao,
  nomeDoCanto,
  type Direcao,
  type EixosIniciais,
} from '../../../lib/transformacoes/eixosIniciais';
import { SEM_ROTACAO, matrizLocal } from '../../../lib/transformacoes/transformacoes';
import { motivoSemReorientar, tamanhoLocalDoElemento, useEditorStore } from '../../../store/editorStore';
import { PassoAPassoEixos, type Rascunho } from './NovoElementoDialog';
import { Vector3 } from 'three';
import styles from './ProjetoEditor.module.css';

const nomeDirecao = (d: Direcao) => NOMES_DIRECAO[d.eixo][d.sinal];

// Reconfigura, num elemento que já existe, os eixos próprios (origem e pra onde apontam X, Y e Z) e a
// colagem (em que superfície ele se gruda ao ser aproximado dela). Os eixos mudam sem mexer no desenho:
// a caixa fica onde está e o conteúdo é reescrito nos eixos novos (ver `reorientarEixos`)
export default function EixosEColagemDialog({ chave, onFechar }: { chave: string; onFechar: () => void }) {
  const elemento = useEditorStore((s) => s.elementos[chave]);
  const reorientarEixos = useEditorStore((s) => s.reorientarEixos);
  const atualizar = useEditorStore((s) => s.atualizar);
  const idEixos = useId();

  // Sem como reconfigurar os eixos (fórmulas, rotação torta...), só a colagem pode mudar
  const impedimento = useMemo(() => motivoSemReorientar(useEditorStore.getState(), chave), [chave]);
  const eixosAtuais = useMemo<EixosIniciais>(
    () => eixosDaRotacao(elemento?.rotacao ?? SEM_ROTACAO) ?? EIXOS_PADRAO,
    [elemento?.rotacao],
  );

  // Medidas da caixa nos eixos do pai (pra prévia): as próprias, trocadas de lugar conforme a rotação
  const medidas = useMemo<Posicao>(() => {
    const proprias = elemento ? tamanhoLocalDoElemento(elemento) : null;
    if (!elemento || !proprias) return { x: 600, y: 550, z: 720 };
    const m = matrizLocal({ x: 0, y: 0, z: 0 }, elemento.rotacao ?? SEM_ROTACAO);
    const v = new Vector3(proprias.x, proprias.y, proprias.z).applyMatrix4(m);
    return { x: Math.abs(v.x), y: Math.abs(v.y), z: Math.abs(v.z) };
  }, [elemento]);

  const [eixos, setEixos] = useState<EixosIniciais>(eixosAtuais);
  const [rascunho, setRascunho] = useState<Rascunho>({
    etapa: 'origem',
    canto: cantoDaOrigem(eixosAtuais),
    x: eixosAtuais.x,
    y: eixosAtuais.y,
  });
  const [colagem, setColagem] = useState<ColagemElemento>(elemento?.colagem ?? 'nenhuma');
  const [erro, setErro] = useState<string | null>(null);

  if (!elemento) return null;
  const z = direcaoZ(eixos);
  const mudouEixos = !mesmaDirecao(eixos.x, eixosAtuais.x) || !mesmaDirecao(eixos.y, eixosAtuais.y);

  function confirmar() {
    if (!impedimento && (!rascunho.x || !rascunho.y)) {
      setErro('Termine a configuração dos eixos (ou cancele) antes de aplicar.');
      return;
    }
    if (!impedimento && mudouEixos) {
      const motivo = reorientarEixos(chave, eixos);
      if (motivo) {
        setErro(motivo);
        return;
      }
    }
    if (colagem !== (elemento?.colagem ?? 'nenhuma')) atualizar(chave, { colagem });
    onFechar();
  }

  return (
    <DialogoConfirmacao
      aberto
      className={styles.dialogoLargo}
      titulo="Eixos e colagem"
      textoConfirmar="Aplicar"
      textoConfirmando="Aplicando…"
      erro={erro}
      onConfirmar={confirmar}
      onCancelar={onFechar}
    >
      <div className={styles.novoElemento}>
        <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>Eixos</legend>
          {impedimento ? (
            <p className={styles.dicaCampo}>{impedimento}</p>
          ) : (
            <>
              <div className={styles.grupoInfo}>
                <span>
                  Origem no {nomeDoCanto(cantoDaOrigem(eixos))}, X pra {nomeDirecao(eixos.x).toLowerCase()}, Y pra{' '}
                  {nomeDirecao(eixos.y).toLowerCase()} e Z pra {nomeDirecao(z).toLowerCase()}.
                </span>
              </div>
              <PassoAPassoEixos
                id={idEixos}
                medidas={medidas}
                rascunho={rascunho}
                onMudar={(r) => {
                  setRascunho(r);
                  if (r.x && r.y) setEixos({ x: r.x, y: r.y });
                  setErro(null);
                }}
                onRestaurarPadrao={() => {
                  setEixos(EIXOS_PADRAO);
                  setRascunho({ etapa: 'origem', canto: cantoDaOrigem(EIXOS_PADRAO), x: EIXOS_PADRAO.x, y: EIXOS_PADRAO.y });
                  setErro(null);
                }}
              />
              <p className={styles.dicaCampo}>
                O desenho não muda: a caixa fica onde está e as medidas e o conteúdo passam a seguir os eixos novos.
              </p>
            </>
          )}
        </fieldset>

        <fieldset className={styles.grupo}>
          <label className={styles.campo}>
            <span className={styles.rotulo}>Fixar a</span>
            <select
              className={styles.input}
              value={colagem}
              onChange={(e) => setColagem(e.target.value as ColagemElemento)}
            >
              {COLAGENS.map((c) => (
                <option key={c} value={c}>
                  {NOME_COLAGEM[c]}
                </option>
              ))}
            </select>
            <span className={styles.dicaCampo}>
              Ao aproximar o elemento de uma parede ou de outro módulo da superfície escolhida, ele gira pra o plano da
              base dele (o plano dos eixos X e Y, com o Z apontando pra fora) encostar nela.
            </span>
          </label>
        </fieldset>
      </div>
    </DialogoConfirmacao>
  );
}
