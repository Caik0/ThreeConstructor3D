import { useState } from 'react';
import CampoMedida from '../../../components/ui/CampoMedida/CampoMedida';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import { FACES_TEXTURA } from '../../../lib/formas/formas';
import { LIMITE_POSICAO, MEDIDA_MAXIMA, MEDIDA_MINIMA, type Posicao } from '../../../lib/projetos/projetos';
import { SENTIDO_Z } from '../../../lib/transformacoes/convencao';
import { paiParaCriacao, tamanhoLocalDoElemento, useEditorStore, type DadosFuro } from '../../../store/editorStore';
import styles from './ProjetoEditor.module.css';

type TipoFuro = 'face' | 'passante';
type Eixo = DadosFuro['eixo'];

const ROTULO_EIXO: Record<Eixo, string> = {
  z: 'Vertical (altura)',
  x: 'Horizontal (largura)',
  y: 'Horizontal (profundidade)',
};

// Eixos do plano de cada face, na ordem em que a posição é pedida
const EIXOS_DA_FACE: Record<string, [string, string]> = {
  topo: ['Largura', 'Profundidade'],
  base: ['Largura', 'Profundidade'],
  frente: ['Largura', 'Altura'],
  fundo: ['Largura', 'Altura'],
  direita: ['Profundidade', 'Altura'],
  esquerda: ['Profundidade', 'Altura'],
};

const DIAMETRO_PADRAO = 8;
const PROFUNDIDADE_PADRAO = 12;
const COMPRIMENTO_PADRAO = 18;
// O furo de face avança um pouco pra fora da face, senão ficaria todo escondido dentro da peça
const SALIENCIA_FURO = 0.5;

/** Extensão do pai ao longo de um eixo, ou o padrão se o pai não tiver tamanho (raiz) */
const extensao = (tamanho: Posicao | null, eixo: Eixo) => tamanho?.[eixo] ?? COMPRIMENTO_PADRAO;

/** Centro da face, em coordenadas do plano dela (ver EIXOS_DA_FACE) */
function centroDaFace(face: string, t: Posicao | null) {
  if (!t) return { x: 50, y: 50 };
  if (face === 'topo' || face === 'base') return { x: t.x / 2, y: t.y / 2 };
  if (face === 'frente' || face === 'fundo') return { x: t.x / 2, y: t.z / 2 };
  return { x: t.y / 2, y: t.z / 2 };
}

/** Cilindro que entra `profundidade` na face e sai `SALIENCIA_FURO` pra fora dela, com o centro em
 * (u, v) no plano da face. Eixos dos dados: X largura, Y profundidade (na convenção 2 a origem fica no
 * FUNDO: o fundo é Y=0 e a frente o Y máximo; na 1 era o contrário), Z altura */
function furoNaFace(face: string, t: Posicao, u: number, v: number, profundidade: number, diametro: number): DadosFuro {
  const comprimento = profundidade + SALIENCIA_FURO;
  const recuo = profundidade / 2 - SALIENCIA_FURO / 2; // do plano da face pra dentro, até o centro
  // Com o Y crescendo pra frente (convenção 2, ver lib/transformacoes/convencao.ts) a frente é o Y máximo
  // e o fundo a origem; na convenção 1 é o contrário
  const frenteNoMaximo = SENTIDO_Z > 0;
  switch (face) {
    case 'topo':
      return { diametro, comprimento, eixo: 'z', centro: { x: u, y: v, z: t.z - recuo } };
    case 'base':
      return { diametro, comprimento, eixo: 'z', centro: { x: u, y: v, z: recuo } };
    case 'frente':
      return { diametro, comprimento, eixo: 'y', centro: { x: u, y: frenteNoMaximo ? t.y - recuo : recuo, z: v } };
    case 'fundo':
      return { diametro, comprimento, eixo: 'y', centro: { x: u, y: frenteNoMaximo ? recuo : t.y - recuo, z: v } };
    case 'esquerda':
      return { diametro, comprimento, eixo: 'x', centro: { x: recuo, y: u, z: v } };
    default:
      return { diametro, comprimento, eixo: 'x', centro: { x: t.x - recuo, y: u, z: v } };
  }
}

// Modal de criação de furo: o usuário define tipo, medidas e posição (relativa ao pai) antes de o
// elemento existir. Os dois tipos viram um cilindro de categoria furação dentro do elemento
// selecionado (ver paiParaCriacao): o de face fica sobre uma das faces dele; o passante atravessa
export default function NovoFuroDialog({ onFechar }: { onFechar: () => void }) {
  const elementos = useEditorStore((s) => s.elementos);
  const selecionada = useEditorStore((s) => s.selecionada);
  const contexto = useEditorStore((s) => s.contexto);
  const adicionarFuro = useEditorStore((s) => s.adicionarFuro);

  const alvo = selecionada ? elementos[selecionada] : undefined;
  const tamanhoAlvo = alvo ? tamanhoLocalDoElemento(alvo) : null;
  // Qualquer peça ou grupo, menos ferragem e furação (que não recebem furos)
  const podeNaFace =
    !!alvo &&
    (alvo.tipo === 'peca' || alvo.tipo === 'grupo') &&
    alvo.categoria !== 'ferragem' &&
    alvo.categoria !== 'furacao' &&
    tamanhoAlvo !== null;

  const chavePai = paiParaCriacao({ elementos, selecionada, contexto });
  const pai = chavePai ? elementos[chavePai] : undefined;
  const tamanhoPai = pai ? tamanhoLocalDoElemento(pai) : null;

  const [tipo, setTipo] = useState<TipoFuro>(podeNaFace ? 'face' : 'passante');
  const [diametro, setDiametro] = useState(DIAMETRO_PADRAO);

  // Furo na face
  const [face, setFace] = useState('frente');
  const [profundidade, setProfundidade] = useState(PROFUNDIDADE_PADRAO);
  const [posicaoFace, setPosicaoFace] = useState(() => centroDaFace('frente', tamanhoAlvo));

  // Furo passante: por padrão atravessa o pai inteiro, no centro dele
  const [eixo, setEixo] = useState<Eixo>('z');
  const [comprimento, setComprimento] = useState(() => extensao(tamanhoPai, 'z'));
  const [centro, setCentro] = useState<Posicao>(() =>
    tamanhoPai ? { x: tamanhoPai.x / 2, y: tamanhoPai.y / 2, z: tamanhoPai.z / 2 } : { x: 0, y: 0, z: 0 },
  );

  const [rotuloX, rotuloY] = EIXOS_DA_FACE[face] ?? ['X', 'Y'];

  function confirmar() {
    if (tipo === 'face') {
      if (!podeNaFace || !tamanhoAlvo) return;
      adicionarFuro(furoNaFace(face, tamanhoAlvo, posicaoFace.x, posicaoFace.y, profundidade, diametro));
    } else {
      adicionarFuro({ diametro, comprimento, eixo, centro });
    }
    onFechar();
  }

  const campo = (
    rotulo: string,
    valor: number,
    aoMudar: (valor: number) => void,
    { min = MEDIDA_MINIMA, max = MEDIDA_MAXIMA }: { min?: number; max?: number } = {},
  ) => <CampoMedida rotulo={rotulo} valor={valor} min={min} max={max} onConfirmar={(v) => aoMudar(v)} />;

  return (
    <DialogoConfirmacao
      aberto
      className={styles.dialogoLargo}
      titulo="Novo furo"
      textoConfirmar="Criar furo"
      textoConfirmando="Criando…"
      onConfirmar={confirmar}
      onCancelar={onFechar}
    >
      <div>
        <fieldset className={styles.grupo}>
          <legend className={styles.grupoTitulo}>Tipo</legend>
          <label>
            <input
              type="radio"
              name="tipo-furo"
              checked={tipo === 'face'}
              disabled={!podeNaFace}
              onChange={() => setTipo('face')}
            />{' '}
            Na face{podeNaFace ? ` de “${alvo?.nome}”` : ' (selecione uma peça ou grupo)'}
          </label>
          <label>
            <input type="radio" name="tipo-furo" checked={tipo === 'passante'} onChange={() => setTipo('passante')} />{' '}
            Passante{pai ? ` (dentro de “${pai.nome}”)` : ''}
          </label>
        </fieldset>

        {campo('Diâmetro', diametro, setDiametro)}

        {tipo === 'face' ? (
          <>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Face</span>
              <select
                className={styles.input}
                value={face}
                onChange={(e) => {
                  setFace(e.target.value);
                  setPosicaoFace(centroDaFace(e.target.value, tamanhoAlvo));
                }}
              >
                {FACES_TEXTURA.caixa.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            {campo(`${rotuloX} (centro)`, posicaoFace.x, (x) => setPosicaoFace((p) => ({ ...p, x })), {
              min: 0,
              max: LIMITE_POSICAO,
            })}
            {campo(`${rotuloY} (centro)`, posicaoFace.y, (y) => setPosicaoFace((p) => ({ ...p, y })), {
              min: 0,
              max: LIMITE_POSICAO,
            })}
            {campo('Profundidade', profundidade, setProfundidade)}
          </>
        ) : (
          <>
            <label className={styles.campo}>
              <span className={styles.rotulo}>Direção</span>
              <select
                className={styles.input}
                value={eixo}
                onChange={(e) => {
                  const novo = e.target.value as Eixo;
                  setEixo(novo);
                  setComprimento(extensao(tamanhoPai, novo));
                }}
              >
                {(Object.keys(ROTULO_EIXO) as Eixo[]).map((e) => (
                  <option key={e} value={e}>
                    {ROTULO_EIXO[e]}
                  </option>
                ))}
              </select>
            </label>
            {campo('Comprimento', comprimento, setComprimento)}
            {campo('Posição X', centro.x, (x) => setCentro((c) => ({ ...c, x })), {
              min: -LIMITE_POSICAO,
              max: LIMITE_POSICAO,
            })}
            {campo('Posição Y', centro.y, (y) => setCentro((c) => ({ ...c, y })), {
              min: -LIMITE_POSICAO,
              max: LIMITE_POSICAO,
            })}
            {campo('Posição Z', centro.z, (z) => setCentro((c) => ({ ...c, z })), {
              min: -LIMITE_POSICAO,
              max: LIMITE_POSICAO,
            })}
          </>
        )}
      </div>
    </DialogoConfirmacao>
  );
}
