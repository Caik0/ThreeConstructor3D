import { useEffect, useId, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import ModuloViewport from '../../../components/three/ModuloViewport/ModuloViewport';
import AlternadorTema from '../../../components/ui/AlternadorTema/AlternadorTema';
import VoltarLink from '../../../components/ui/VoltarLink/VoltarLink';
import { ApiError } from '../../../lib/api/client';
import { useModulo, useSalvarConteudoModulo } from '../../../lib/hooks/useModulos';
import { useTemPermissao } from '../../../lib/hooks/usePermissoes';
import { PERMISSOES } from '../../../lib/permissoes/permissoes';
import { elementoValido } from '../../../lib/projetos/projetos';
import { RAIZ, ancestrais, montarEntradaElemento, useEditorStore } from '../../../store/editorStore';
import ArvoreElementos from './ArvoreElementos';
import AcoesModulos from './AcoesModulos';
import BarraFerramentas from './BarraFerramentas';
import PainelElemento from './PainelElemento';
import styles from './ProjetoEditor.module.css';
import VistaExplodida from './VistaExplodida';

// Mesmo ponto de corte do CSS (@media max-width: 720px)
const CONSULTA_CELULAR = '(max-width: 720px)';

// Detecta celular pra, lá, não abrir sozinho o painel de propriedades ao selecionar um módulo:
// no espaço apertado da tela, ele cobre boa parte da cena e atrapalha usar mover/girar
function useCelular() {
  const [celular, setCelular] = useState(() => window.matchMedia(CONSULTA_CELULAR).matches);
  useEffect(() => {
    const consulta = window.matchMedia(CONSULTA_CELULAR);
    const ouvir = () => setCelular(consulta.matches);
    consulta.addEventListener('change', ouvir);
    return () => consulta.removeEventListener('change', ouvir);
  }, []);
  return celular;
}

// Editor de um módulo avulso (peça ou grupo salvo à parte de qualquer projeto): mesma cena, painéis
// e ferramentas do editor de projeto, mas o conteúdo é só a subárvore do módulo, sem planta de
// ambiente; salvar substitui a árvore inteira do módulo, não uma lista de elementos de projeto
export default function ModuloEditor() {
  const moduloId = Number(useParams().id);
  const consulta = useModulo(moduloId);
  const salvar = useSalvarConteudoModulo(moduloId);
  const [estruturaAberta, setEstruturaAberta] = useState(true);
  const idPainelEstrutura = useId();
  const celular = useCelular();
  const [propriedadesAbertasPara, setPropriedadesAbertasPara] = useState<string | null>(null);
  const [ultimaSelecionadaVista, setUltimaSelecionadaVista] = useState<string | null>(null);

  const moduloCarregado = useEditorStore((s) => s.moduloId);
  const elementos = useEditorStore((s) => s.elementos);
  const filhos = useEditorStore((s) => s.filhos);
  const selecionada = useEditorStore((s) => s.selecionada);
  const selecionadasExtra = useEditorStore((s) => s.selecionadasExtra);
  const contexto = useEditorStore((s) => s.contexto);
  const ferramenta = useEditorStore((s) => s.ferramenta);
  const explodido = useEditorStore((s) => s.explodido);
  const definirDistanciaExplosao = useEditorStore((s) => s.definirDistanciaExplosao);
  const fecharExplosao = useEditorStore((s) => s.fecharExplosao);
  const alterado = useEditorStore((s) => s.alterado);
  const carregarModulo = useEditorStore((s) => s.carregarModulo);
  const limpar = useEditorStore((s) => s.limpar);
  const selecionar = useEditorStore((s) => s.selecionar);
  const selecionarPorPeca = useEditorStore((s) => s.selecionarPorPeca);
  const alternarSelecaoMultipla = useEditorStore((s) => s.alternarSelecaoMultipla);
  const abrirPorPeca = useEditorStore((s) => s.abrirPorPeca);
  const abrirContexto = useEditorStore((s) => s.abrirContexto);
  const sair = useEditorStore((s) => s.sair);
  const definirFerramenta = useEditorStore((s) => s.definirFerramenta);
  const definirTextura = useEditorStore((s) => s.definirTextura);
  const aplicarTexturaPorGrupo = useEditorStore((s) => s.aplicarTexturaPorGrupo);
  const remover = useEditorStore((s) => s.remover);
  const atualizar = useEditorStore((s) => s.atualizar);
  const adicionarParedes = useEditorStore((s) => s.adicionarParedes);
  const atualizarParedes = useEditorStore((s) => s.atualizarParedes);
  const desfazer = useEditorStore((s) => s.desfazer);
  const refazer = useEditorStore((s) => s.refazer);
  const podeDesfazer = useEditorStore((s) => s.historico.passado.length > 0);
  const podeRefazer = useEditorStore((s) => s.historico.futuro.length > 0);

  // A raiz do módulo (o único elemento de topo): editar aqui nunca mexe na planta de um ambiente
  const raizModulo = filhos[RAIZ]?.[0] ?? null;

  // Esvazia o editor ao sair, para não reaproveitar elementos de outro módulo/projeto
  useEffect(() => limpar, [limpar]);

  // Carrega o módulo uma única vez; depois disso o estado do editor é a fonte da verdade
  useEffect(() => {
    if (consulta.data && useEditorStore.getState().moduloId !== consulta.data.id) {
      carregarModulo(consulta.data);
    }
  }, [consulta.data, carregarModulo]);

  if (selecionada !== ultimaSelecionadaVista) {
    setUltimaSelecionadaVista(selecionada);
    setPropriedadesAbertasPara(null);
  }

  const mostrarPropriedades = selecionada !== null && (!celular || propriedadesAbertasPara === selecionada);

  const listaElementos = Object.values(elementos);
  const todosValidos = listaElementos.every((e) => elementoValido(e, e.pai ? elementos[e.pai]?.parede : undefined));
  const podeGerenciarModulo = useTemPermissao(PERMISSOES.MODULOS_GERENCIAR);
  const podeSalvar = alterado && todosValidos && raizModulo !== null && !salvar.isPending && podeGerenciarModulo;

  function salvarAlteracoes() {
    if (!podeSalvar || !raizModulo) return;
    const elemento = montarEntradaElemento(useEditorStore.getState(), raizModulo);
    salvar.mutate(elemento, {
      onSuccess: (modulo) => carregarModulo(modulo, true),
    });
  }

  // Mesmos atalhos do editor de projeto (ver o de lá para a lista completa); a única diferença é
  // que Esc não sai além da raiz do módulo, já que não existe nada "acima" dela pra editar aqui
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        salvarAlteracoes();
        return;
      }

      const digitando = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;

      if (!digitando && !salvar.isPending && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) refazer();
        else desfazer();
        return;
      }
      if (!digitando && !salvar.isPending && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        refazer();
        return;
      }

      if (digitando || e.ctrlKey || e.metaKey || e.altKey || salvar.isPending) return;
      if (ferramenta === 'parede' || ferramenta === 'trena' || ferramenta === 'pintura') return;

      const tecla = e.key.toLowerCase();
      if (tecla === 'escape') {
        if (selecionada) selecionar(null);
        else if (contexto !== raizModulo) sair();
      } else if (tecla === 'delete' && selecionada && selecionada !== raizModulo) {
        remover(selecionada);
      } else if (tecla === 'v') {
        definirFerramenta('selecionar');
      } else if (tecla === 'm') {
        definirFerramenta('mover');
      } else if (tecla === 'q') {
        definirFerramenta('girar');
      } else if (tecla === 'p') {
        definirFerramenta('parede');
      } else if (tecla === 't') {
        definirFerramenta('trena');
      } else if (tecla === 'b') {
        definirFerramenta('pintura');
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  });

  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) => alterado && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (bloqueio.state !== 'blocked') return;
    if (window.confirm('Há alterações não salvas. Sair mesmo assim?')) bloqueio.proceed();
    else bloqueio.reset();
  }, [bloqueio]);

  useEffect(() => {
    if (!alterado) return;
    const aoSairDaPagina = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aoSairDaPagina);
    return () => window.removeEventListener('beforeunload', aoSairDaPagina);
  }, [alterado]);

  if (!Number.isInteger(moduloId) || consulta.isError) {
    const naoEncontrado =
      !Number.isInteger(moduloId) || (consulta.error instanceof ApiError && consulta.error.status === 404);
    return (
      <div className={styles.aviso} role="alert">
        <p>
          {naoEncontrado ? 'Módulo não encontrado.' : `Não foi possível carregar o módulo: ${consulta.error?.message}`}
        </p>
        <Link to="/modulos">Voltar para módulos</Link>
      </div>
    );
  }

  if (moduloCarregado !== moduloId) {
    return (
      <div className={styles.aviso}>
        <p>Carregando módulo…</p>
      </div>
    );
  }

  const status = salvar.isPending
    ? 'Salvando…'
    : raizModulo === null
      ? 'Adicione ao menos um elemento para salvar'
      : !todosValidos
        ? 'Corrija os elementos marcados para salvar'
        : alterado
          ? 'Alterações não salvas'
          : 'Tudo salvo';

  // Caminho do grupo aberto, da raiz do módulo (exclusive) até ele — a própria raiz não aparece
  // na trilha, já que não há como "sair" dela aqui
  const caminhoContexto =
    contexto && contexto !== raizModulo
      ? [...ancestrais(elementos, contexto).reverse(), contexto].filter((c) => c !== raizModulo)
      : [];

  return (
    <div className={styles.editor}>
      <header className={styles.topo}>
        <VoltarLink to="/modulos">Módulos</VoltarLink>
        <div className={styles.titulo}>
          <h1 className={styles.nome}>{consulta.data?.nome}</h1>
          {caminhoContexto.length > 0 && (
            <nav aria-label="Editando dentro de" className={styles.trilha}>
              {caminhoContexto.map((chave) => {
                const nome = elementos[chave].nome.trim() || 'Sem nome';
                return (
                  <span key={chave} className={styles.trilhaItem}>
                    <span aria-hidden="true">›</span>
                    {chave === contexto ? (
                      <span className={styles.trilhaAtual} aria-current="location">
                        {nome}
                      </span>
                    ) : (
                      <button type="button" className={styles.trilhaLink} onClick={() => abrirContexto(chave)}>
                        {nome}
                      </button>
                    )}
                  </span>
                );
              })}
              <button type="button" className={styles.sairGrupo} onClick={sair} title="Sair (Esc)">
                Sair
              </button>
            </nav>
          )}
        </div>
        <span className={`${styles.divisor} ${styles.divisorFerramentas}`} aria-hidden="true" />
        <BarraFerramentas />
        <AcoesModulos />
        <span className={`${styles.divisor} ${styles.divisorFerramentas}`} aria-hidden="true" />
        <div className={styles.historico}>
          <button
            type="button"
            className={styles.botaoHistorico}
            onClick={desfazer}
            disabled={!podeDesfazer}
            aria-label="Desfazer"
            title="Desfazer (Ctrl+Z)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.botaoHistorico}
            onClick={refazer}
            disabled={!podeRefazer}
            aria-label="Refazer"
            title="Refazer (Ctrl+Shift+Z)"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
            </svg>
          </button>
        </div>
        <span className={styles.divisor} aria-hidden="true" />
        <button
          type="button"
          className={styles.botaoPainel}
          aria-expanded={estruturaAberta}
          aria-controls={idPainelEstrutura}
          onClick={() => setEstruturaAberta((aberta) => !aberta)}
        >
          Estrutura <span className={styles.contador}>{listaElementos.length}</span>
        </button>
        <span className={styles.status} role="status">
          {status}
        </span>
        <AlternadorTema />
        {podeGerenciarModulo && (
        <button
          type="button"
          className={styles.salvar}
          onClick={salvarAlteracoes}
          disabled={!podeSalvar}
          title="Salvar (Ctrl+S)"
        >
          Salvar
        </button>
        )}
      </header>

      {estruturaAberta && (
        <aside
          id={idPainelEstrutura}
          className={`${styles.flutuante} ${styles.painel} ${styles.painelEstrutura}`}
          aria-label="Estrutura do módulo"
        >
          <fieldset className={styles.painelConteudo} disabled={salvar.isPending}>
            <ArvoreElementos onFechar={() => setEstruturaAberta(false)} />
          </fieldset>
        </aside>
      )}

      {mostrarPropriedades && (
        <aside
          className={`${styles.flutuante} ${styles.painel} ${styles.painelPropriedades}`}
          aria-label="Propriedades do elemento"
        >
          <fieldset className={styles.painelConteudo} disabled={salvar.isPending}>
            <PainelElemento onFechar={() => (celular ? setPropriedadesAbertasPara(null) : selecionar(null))} />
          </fieldset>
        </aside>
      )}

      {celular && selecionada && !mostrarPropriedades && (
        <button
          type="button"
          className={styles.botaoRevelarPropriedades}
          onClick={() => setPropriedadesAbertasPara(selecionada)}
        >
          Ver propriedades
        </button>
      )}

      {explodido && elementos[explodido.chave] && (
        <VistaExplodida
          distancia={explodido.distancia}
          onMudarDistancia={definirDistanciaExplosao}
          onReagrupar={() => definirDistanciaExplosao(0)}
          onFechar={fecharExplosao}
        />
      )}

      {salvar.isError && (
        <p className={styles.erroSalvar} role="alert">
          Não foi possível salvar: {salvar.error.message}
        </p>
      )}

      <div className={styles.viewport}>
        <ModuloViewport
          elementos={elementos}
          planta={null}
          selecionada={selecionada}
          contexto={contexto}
          ferramenta={ferramenta}
          explodido={explodido}
          selecaoExtra={selecionadasExtra}
          onClicarPeca={(chave, comCtrl) => {
            if (comCtrl) {
              if (chave) alternarSelecaoMultipla(chave, true);
              return;
            }
            selecionarPorPeca(chave);
          }}
          onDuploCliquePeca={abrirPorPeca}
          onTransformar={atualizar}
          onConcluirParedes={(pontos, fechado, opcoes, chaveAlvo, engateInicio, engateFim) => {
            if (chaveAlvo) atualizarParedes(chaveAlvo, pontos, fechado, opcoes, engateInicio, engateFim);
            else adicionarParedes(pontos, fechado, opcoes, engateInicio, engateFim);
            definirFerramenta('selecionar');
          }}
          onCancelarParede={() => definirFerramenta('selecionar')}
          onPintarFace={definirTextura}
          onPintarGrupo={aplicarTexturaPorGrupo}
        />
      </div>
    </div>
  );
}
