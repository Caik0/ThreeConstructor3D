import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { FORMAS, TIPOS_FORMA_NOVOS, descreverForma } from '../../../lib/formas/formas';
import { useSalvarModulo } from '../../../lib/hooks/useModulos';
import { useTemPermissao } from '../../../lib/hooks/usePermissoes';
import { PERMISSOES } from '../../../lib/permissoes/permissoes';
import {
  MAXIMO_ELEMENTOS,
  TAMANHO_NOME_ELEMENTO,
  descreverAbertura,
  descreverModelo3d,
  descreverParede,
  descreverPiso,
  elementoValido,
} from '../../../lib/projetos/projetos';
import {
  RAIZ,
  aceitaFilho,
  ancestrais,
  estaDentro,
  montarEntradaElemento,
  useEditorStore,
  type Arvore,
} from '../../../store/editorStore';
import DialogoConfirmacao from '../../../components/ui/DialogoConfirmacao/DialogoConfirmacao';
import ImportarModuloDialog from './ImportarModuloDialog';
import styles from './ProjetoEditor.module.css';

const iconProps = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const ICONES = {
  grupo: (
    <svg {...iconProps}>
      <path d="M12 3 3 7.5l9 4.5 9-4.5z" />
      <path d="M3 7.5v9L12 21l9-4.5v-9M12 12v9" />
    </svg>
  ),
  peca: (
    <svg {...iconProps}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
  ),
  parede: (
    <svg {...iconProps}>
      <path d="M3 5h18M3 19h18M3 5v14M21 5v14M12 5v6M7 11v8M17 11v8" />
    </svg>
  ),
  abertura: (
    <svg {...iconProps}>
      <rect x="6" y="3" width="12" height="18" rx="1" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  piso: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  expandir: (
    <svg {...iconProps}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
  agrupar: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="4 3" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  ),
  desagrupar: (
    <svg {...iconProps}>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="13" width="8" height="8" rx="1" />
    </svg>
  ),
  duplicar: (
    <svg {...iconProps}>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  ),
  salvarModulo: (
    <svg {...iconProps}>
      <path d="M6 4h12v16l-6-4-6 4Z" />
    </svg>
  ),
  remover: (
    <svg {...iconProps}>
      <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    </svg>
  ),
  fechar: (
    <svg {...iconProps}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  visivel: (
    <svg {...iconProps}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  oculto: (
    <svg {...iconProps}>
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M6.6 6.6C3.7 8.3 2 12 2 12s4 7 10 7c1.8 0 3.4-.5 4.8-1.4M17.4 17.4C19.6 15.9 22 12 22 12s-1.1-2-3.2-3.8" />
    </svg>
  ),
};

// O arraste usa eventos de ponteiro em vez do arrastar-e-soltar nativo (HTML5): no Windows a
// sessão de arraste nativa podia ficar presa e travar a página inteira

// Deslocamento mínimo (px) para um clique virar arraste
const DISTANCIA_INICIO_ARRASTE = 5;

type Zona = 'antes' | 'dentro' | 'depois';

/** Onde o elemento vai entrar; a chave RAIZ representa a faixa "fim da raiz" */
interface Alvo {
  chave: string;
  zona: Zona;
}

// Metade de cima da linha: antes; metade de baixo: depois; num alvo que aceita o tipo arrastado
// como filho, a faixa do meio: dentro
function zonaSoltar(area: DOMRect, y: number, aceitaDentro: boolean): Zona {
  const relativo = (y - area.top) / area.height;
  if (aceitaDentro) return relativo < 0.25 ? 'antes' : relativo > 0.75 ? 'depois' : 'dentro';
  return relativo < 0.5 ? 'antes' : 'depois';
}

// Pai e posição na lista que resultam de soltar no alvo
function destino(arvore: Arvore, arrastado: string, alvo: Alvo): { pai: string | null; antesDe?: string } {
  if (alvo.chave === RAIZ) return { pai: null };
  const elemento = arvore.elementos[alvo.chave];
  if (alvo.zona === 'dentro') return { pai: alvo.chave };
  if (alvo.zona === 'antes') return { pai: elemento.pai, antesDe: alvo.chave };
  const irmaos = (arvore.filhos[elemento.pai ?? RAIZ] ?? []).filter((c) => c !== arrastado);
  return { pai: elemento.pai, antesDe: irmaos[irmaos.indexOf(alvo.chave) + 1] };
}

// Linha (ou faixa da raiz) sob o ponteiro onde o elemento pode ser solto
function alvoSobPonteiro(arvore: Arvore, arrastado: string, x: number, y: number): Alvo | null {
  const sob = document.elementFromPoint(x, y);
  if (sob?.closest('[data-soltar-raiz]')) return { chave: RAIZ, zona: 'dentro' };

  const linha = sob?.closest<HTMLElement>('[data-elemento]');
  const chave = linha?.dataset.elemento;
  if (!linha || !chave || chave === arrastado || !arvore.elementos[chave]) return null;

  const tipoArrastado = arvore.elementos[arrastado].tipo;
  const alvo: Alvo = {
    chave,
    zona: zonaSoltar(linha.getBoundingClientRect(), y, aceitaFilho(arvore.elementos[chave].tipo, tipoArrastado)),
  };
  // Não solta dentro do próprio conteúdo, nem num pai que não aceita esse tipo de elemento
  const { pai } = destino(arvore, arrastado, alvo);
  if (pai === null) return aceitaFilho('grupo', tipoArrastado) ? alvo : null;
  return !estaDentro(arvore.elementos, pai, arrastado) && aceitaFilho(arvore.elementos[pai]?.tipo, tipoArrastado) ? alvo : null;
}

interface ArvoreElementosProps {
  onFechar: () => void;
}

export default function ArvoreElementos({ onFechar }: ArvoreElementosProps) {
  const elementos = useEditorStore((s) => s.elementos);
  const filhos = useEditorStore((s) => s.filhos);
  const moduloId = useEditorStore((s) => s.moduloId);
  const selecionada = useEditorStore((s) => s.selecionada);
  const selecionadasExtra = useEditorStore((s) => s.selecionadasExtra);
  const contexto = useEditorStore((s) => s.contexto);
  const selecionar = useEditorStore((s) => s.selecionar);
  const alternarSelecaoMultipla = useEditorStore((s) => s.alternarSelecaoMultipla);
  const abrirContexto = useEditorStore((s) => s.abrirContexto);
  const adicionarPeca = useEditorStore((s) => s.adicionarPeca);
  const adicionarGrupo = useEditorStore((s) => s.adicionarGrupo);
  const adicionarParede = useEditorStore((s) => s.adicionarParede);
  const agrupar = useEditorStore((s) => s.agrupar);
  const desagrupar = useEditorStore((s) => s.desagrupar);
  const duplicar = useEditorStore((s) => s.duplicar);
  const importarModulo = useEditorStore((s) => s.importarModulo);
  const remover = useEditorStore((s) => s.remover);
  const moverPara = useEditorStore((s) => s.moverPara);
  const alternarVisibilidade = useEditorStore((s) => s.alternarVisibilidade);
  const definirVisibilidadeTodos = useEditorStore((s) => s.definirVisibilidadeTodos);
  const salvarModulo = useSalvarModulo();
  const podeCriarForma = useTemPermissao(PERMISSOES.ESTRUTURA_CRIAR_FORMA);
  const podeCriarGrupo = useTemPermissao(PERMISSOES.ESTRUTURA_CRIAR_GRUPO);
  const podeCriarParede = useTemPermissao(PERMISSOES.ESTRUTURA_CRIAR_PAREDE);
  const podeImportarModulo = useTemPermissao(PERMISSOES.ESTRUTURA_IMPORTAR_MODULO);
  const podeSalvarComoModulo = useTemPermissao(PERMISSOES.ESTRUTURA_SALVAR_COMO_MODULO);
  const podeAgrupar = useTemPermissao(PERMISSOES.ESTRUTURA_AGRUPAR);
  const podeDuplicar = useTemPermissao(PERMISSOES.ESTRUTURA_DUPLICAR);
  const podeRemover = useTemPermissao(PERMISSOES.ESTRUTURA_REMOVER);
  const podeVisibilidade = useTemPermissao(PERMISSOES.ESTRUTURA_VISIBILIDADE);

  const [recolhidos, setRecolhidos] = useState<Set<string>>(() => new Set());
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<Alvo | null>(null);
  const [nomeModulo, setNomeModulo] = useState<string | null>(null);
  const [importandoModulo, setImportandoModulo] = useState(false);
  const fantasmaRef = useRef<HTMLDivElement>(null);
  const encerrarArrasteRef = useRef<(() => void) | null>(null);
  const raizRef = useRef<HTMLElement>(null);

  // Se o painel fechar no meio de um arraste, remove os listeners da janela
  useEffect(() => () => encerrarArrasteRef.current?.(), []);

  const total = Object.keys(elementos).length;
  // Só módulo tem teto de elementos (ver noLimite em editorStore) — um projeto pode ter vindo de
  // uma importação de .glb bem maior que isso
  const limiteAtingido = moduloId !== null && total >= MAXIMO_ELEMENTOS;
  const todosVisiveis = Object.values(elementos).every((e) => e.visivel !== false);
  const elementoSelecionado = selecionada ? elementos[selecionada] : undefined;
  // Grupos que contêm a seleção ficam sempre expandidos
  const caminhoSelecionada = selecionada ? ancestrais(elementos, selecionada) : [];

  // Ao trocar a seleção (inclusive clicando numa peça direto na cena 3D, não só aqui na árvore),
  // rola o painel até o nó correspondente — ele já vem expandido (ver `aberto` acima), só falta
  // aparecer na tela sem o usuário ter que caçar em meio a uma estrutura grande. Rodar depois do
  // React já ter renderizado os grupos-pai abertos (o node só existe no DOM nesse momento); em
  // elemento já visível, scrollIntoView({block: 'nearest'}) não faz nada, então clicar na própria
  // árvore continua sem pulo nenhum
  useEffect(() => {
    if (!selecionada) return;
    const no = raizRef.current?.querySelector(`[data-elemento="${CSS.escape(selecionada)}"]`);
    no?.scrollIntoView({ block: 'nearest' });
  }, [selecionada]);

  function confirmarSalvarModulo() {
    if (!selecionada || !nomeModulo?.trim()) return;
    const elemento = montarEntradaElemento(useEditorStore.getState(), selecionada);
    salvarModulo.mutate({ nome: nomeModulo.trim(), elemento }, { onSuccess: () => setNomeModulo(null) });
  }

  function alternar(chave: string) {
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function aoPressionarLinha(e: ReactPointerEvent<HTMLDivElement>, chave: string) {
    if (e.button !== 0 || !e.isPrimary) return;
    if ((e.target as HTMLElement).closest('[data-sem-arraste]')) return;

    const inicioX = e.clientX;
    const inicioY = e.clientY;
    let emArraste = false;
    let alvoAtual: Alvo | null = null;

    const encerrar = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', soltar);
      window.removeEventListener('pointercancel', encerrar);
      window.removeEventListener('keydown', aoTeclar, true);
      encerrarArrasteRef.current = null;
      setArrastando(null);
      setAlvo(null);
    };

    const mover = (ev: PointerEvent) => {
      if (!emArraste) {
        if (Math.hypot(ev.clientX - inicioX, ev.clientY - inicioY) < DISTANCIA_INICIO_ARRASTE) return;
        emArraste = true;
        setArrastando(chave);
      }
      if (fantasmaRef.current) {
        fantasmaRef.current.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 14}px)`;
      }
      const novo = alvoSobPonteiro(useEditorStore.getState(), chave, ev.clientX, ev.clientY);
      // Só re-renderiza quando o alvo muda
      if (novo?.chave !== alvoAtual?.chave || novo?.zona !== alvoAtual?.zona) {
        alvoAtual = novo;
        setAlvo(novo);
      }
    };

    const soltar = () => {
      if (emArraste && alvoAtual) {
        const { pai, antesDe } = destino(useEditorStore.getState(), chave, alvoAtual);
        moverPara(chave, pai, antesDe);
      }
      encerrar();
    };

    // Esc cancela o arraste sem limpar a seleção nem sair do grupo
    const aoTeclar = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape' || !emArraste) return;
      ev.stopImmediatePropagation();
      encerrar();
    };

    encerrarArrasteRef.current?.();
    encerrarArrasteRef.current = encerrar;
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', soltar);
    window.addEventListener('pointercancel', encerrar);
    window.addEventListener('keydown', aoTeclar, true);
  }

  function renderizar(pai: string, nivel: number): ReactNode[] {
    return (filhos[pai] ?? []).map((chave) => {
      const elemento = elementos[chave];
      // Grupo e peça podem ser "abertos" (duplo clique edita o conteúdo, como um componente do
      // SketchUp); parede só expande pra mostrar os vãos dela, sem ter conteúdo editável assim
      const podeEditarConteudo = elemento.tipo === 'grupo' || elemento.tipo === 'peca';
      const podeExpandir = podeEditarConteudo || elemento.tipo === 'parede';
      const aberto = podeExpandir && (!recolhidos.has(chave) || caminhoSelecionada.includes(chave));
      const nome = elemento.nome.trim() || 'Sem nome';
      const zonaAlvo = alvo?.chave === chave ? alvo.zona : null;
      const oculto = elemento.visivel === false;
      const classes = [
        styles.no,
        chave === selecionada && styles.noAtivo,
        selecionadasExtra.includes(chave) && styles.noExtraSelecionado,
        chave === contexto && styles.noContexto,
        chave === arrastando && styles.noArrastado,
        oculto && styles.noOculto,
        zonaAlvo === 'antes' && styles.soltarAntes,
        zonaAlvo === 'dentro' && styles.soltarDentro,
        zonaAlvo === 'depois' && styles.soltarDepois,
      ];

      return (
        <li key={chave}>
          <div
            className={classes.filter(Boolean).join(' ')}
            style={{ paddingLeft: 4 + nivel * 14 }}
            data-elemento={chave}
            onPointerDown={(e) => aoPressionarLinha(e, chave)}
          >
            {podeExpandir ? (
              <button
                type="button"
                className={styles.expandir}
                aria-expanded={aberto}
                aria-label={`${aberto ? 'Recolher' : 'Expandir'} ${nome}`}
                onClick={() => alternar(chave)}
                data-sem-arraste
              >
                {ICONES.expandir}
              </button>
            ) : (
              <span className={styles.expandirVazio} />
            )}
            <button
              type="button"
              className={styles.noSelecionar}
              aria-pressed={chave === selecionada || selecionadasExtra.includes(chave)}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) alternarSelecaoMultipla(chave);
                else selecionar(chave);
              }}
              onDoubleClick={() => podeEditarConteudo && abrirContexto(chave)}
              title={
                podeEditarConteudo
                  ? 'Ctrl+clique seleciona vários · duplo clique edita o conteúdo · arraste para reorganizar'
                  : 'Ctrl+clique seleciona vários · arraste para reorganizar'
              }
            >
              <span className={styles.noIcone}>{ICONES[elemento.tipo]}</span>
              <span className={styles.noTexto}>
                <span className={styles.noNome}>{nome}</span>
                {elemento.forma && (
                  <span className={styles.noMedidas}>
                    {descreverForma(elemento.forma.tipo, elemento.forma.parametros)}
                  </span>
                )}
                {elemento.modelo3d && elemento.tamanho && (
                  <span className={styles.noMedidas}>{descreverModelo3d(elemento.tamanho)}</span>
                )}
                {elemento.parede && (
                  <span className={styles.noMedidas}>{descreverParede(elemento.parede)}</span>
                )}
                {elemento.piso && <span className={styles.noMedidas}>{descreverPiso(elemento.piso)}</span>}
                {elemento.abertura && (
                  <span className={styles.noMedidas}>{descreverAbertura(elemento.abertura)}</span>
                )}
                {!elementoValido(elemento, elemento.pai ? elementos[elemento.pai]?.parede : undefined) && (
                  <span className={styles.itemAlerta}>Revisar valores</span>
                )}
              </span>
            </button>
            {podeVisibilidade && (
              <button
                type="button"
                className={styles.noVisibilidade}
                aria-label={oculto ? `Exibir ${nome}` : `Ocultar ${nome}`}
                title={oculto ? 'Exibir' : 'Ocultar'}
                onClick={() => alternarVisibilidade(chave)}
                data-sem-arraste
              >
                {oculto ? ICONES.oculto : ICONES.visivel}
              </button>
            )}
          </div>
          {aberto && (filhos[chave]?.length ?? 0) > 0 && (
            <ul className={styles.arvore}>{renderizar(chave, nivel + 1)}</ul>
          )}
        </li>
      );
    });
  }

  return (
    <section ref={raizRef}>
      <div className={styles.painelTopo}>
        <h2 className={styles.secaoTitulo}>
          Estrutura <span className={styles.contador}>{total}</span>
        </h2>
        <div className={styles.painelTopoAcoes}>
          {podeVisibilidade && (
            <button
              type="button"
              className={styles.fechar}
              disabled={total === 0}
              onClick={() => definirVisibilidadeTodos(!todosVisiveis)}
              aria-label={todosVisiveis ? 'Ocultar todos os elementos' : 'Exibir todos os elementos'}
              title={todosVisiveis ? 'Ocultar tudo' : 'Exibir tudo'}
            >
              {todosVisiveis ? ICONES.visivel : ICONES.oculto}
            </button>
          )}
          <button
            type="button"
            className={styles.fechar}
            onClick={onFechar}
            aria-label="Fechar painel de estrutura"
            title="Fechar"
          >
            {ICONES.fechar}
          </button>
        </div>
      </div>

      <div className={styles.adicionar}>
        {podeCriarForma &&
          TIPOS_FORMA_NOVOS.map((tipo) => (
            <button
              key={tipo}
              type="button"
              className={styles.botaoAdicionar}
              disabled={limiteAtingido}
              onClick={() => adicionarPeca(tipo)}
            >
              + {FORMAS[tipo].nome}
            </button>
          ))}
        {podeCriarGrupo && (
          <button
            type="button"
            className={styles.botaoAdicionar}
            disabled={limiteAtingido}
            onClick={adicionarGrupo}
          >
            + Grupo
          </button>
        )}
        {podeCriarParede && (
          <button
            type="button"
            className={styles.botaoAdicionar}
            disabled={limiteAtingido}
            onClick={adicionarParede}
            title="Adiciona uma única parede solta; para desenhar várias de uma vez, use a ferramenta Parede (P) na barra à esquerda"
          >
            + Parede
          </button>
        )}
        {podeImportarModulo && (
          <button
            type="button"
            className={styles.botaoAdicionar}
            disabled={limiteAtingido}
            onClick={() => setImportandoModulo(true)}
            title="Importa uma peça ou grupo salvo anteriormente como módulo, em outro projeto ou neste"
          >
            + Módulo
          </button>
        )}
      </div>

      <div className={styles.acoesSelecao} role="group" aria-label="Ações do elemento selecionado">
        {podeSalvarComoModulo && (
          <button
            type="button"
            className={styles.acao}
            disabled={!elementoSelecionado || (elementoSelecionado.tipo !== 'peca' && elementoSelecionado.tipo !== 'grupo')}
            onClick={() => setNomeModulo(elementoSelecionado?.nome ?? '')}
            title="Salva esta peça ou grupo à parte, pra poder importar em outros projetos"
          >
            {ICONES.salvarModulo} Salvar como módulo
          </button>
        )}
        {podeAgrupar && (
          <button
            type="button"
            className={styles.acao}
            disabled={!selecionada || limiteAtingido || elementoSelecionado?.tipo === 'abertura'}
            onClick={() => selecionada && agrupar(selecionada)}
          >
            {ICONES.agrupar} Agrupar
          </button>
        )}
        {podeAgrupar && (
          <button
            type="button"
            className={styles.acao}
            disabled={elementoSelecionado?.tipo !== 'grupo'}
            onClick={() => selecionada && desagrupar(selecionada)}
          >
            {ICONES.desagrupar} Desagrupar
          </button>
        )}
        {podeDuplicar && (
          <button
            type="button"
            className={styles.acao}
            disabled={!selecionada || limiteAtingido}
            onClick={() => selecionada && duplicar(selecionada)}
          >
            {ICONES.duplicar} Duplicar
          </button>
        )}
        {podeRemover && (
          <button
            type="button"
            className={styles.acao}
            disabled={!selecionada}
            onClick={() => selecionada && remover(selecionada)}
            title="Remover (Delete)"
          >
            {ICONES.remover} Remover
          </button>
        )}
      </div>

      {total === 0 ? (
        <p className={styles.vazio}>Nenhum elemento ainda. Adicione uma forma ou um grupo acima.</p>
      ) : (
        <ul className={styles.arvore}>{renderizar(RAIZ, 0)}</ul>
      )}

      {arrastando !== null && (
        <div
          className={`${styles.soltarRaiz} ${alvo?.chave === RAIZ ? styles.soltarDentro : ''}`}
          data-soltar-raiz
        >
          Solte aqui para mover para o fim da raiz do projeto
        </div>
      )}

      {/* Fora do painel: o backdrop-filter dele faria o position: fixed ficar relativo ao painel */}
      {createPortal(
        <div ref={fantasmaRef} className={styles.fantasma} hidden={arrastando === null} aria-hidden="true">
          {arrastando !== null && (elementos[arrastando]?.nome.trim() || 'Sem nome')}
        </div>,
        document.body,
      )}

      <DialogoConfirmacao
        aberto={nomeModulo !== null}
        titulo="Salvar como módulo"
        textoConfirmar="Salvar"
        textoConfirmando="Salvando…"
        confirmando={salvarModulo.isPending}
        erro={salvarModulo.isError ? salvarModulo.error.message : null}
        onConfirmar={confirmarSalvarModulo}
        onCancelar={() => setNomeModulo(null)}
      >
        <label className={styles.campo}>
          <span className={styles.rotulo}>Nome do módulo</span>
          <input
            className={styles.input}
            value={nomeModulo ?? ''}
            maxLength={TAMANHO_NOME_ELEMENTO}
            onChange={(e) => setNomeModulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              confirmarSalvarModulo();
            }}
          />
        </label>
      </DialogoConfirmacao>

      <ImportarModuloDialog
        aberto={importandoModulo}
        onEscolher={(elemento) => {
          importarModulo(elemento);
          setImportandoModulo(false);
        }}
        onFechar={() => setImportandoModulo(false)}
      />
    </section>
  );
}
