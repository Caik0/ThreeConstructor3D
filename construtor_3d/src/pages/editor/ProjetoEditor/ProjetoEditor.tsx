import { useEffect, useId, useState } from 'react';
import { Link, useBlocker, useParams } from 'react-router-dom';
import ModuloViewport from '../../../components/three/ModuloViewport/ModuloViewport';
import AlternadorTema from '../../../components/ui/AlternadorTema/AlternadorTema';
import VoltarLink from '../../../components/ui/VoltarLink/VoltarLink';
import { ApiError } from '../../../lib/api/client';
import { useProjeto, useSalvarElementos } from '../../../lib/hooks/useProjetos';
import { useTemPermissao } from '../../../lib/hooks/usePermissoes';
import { PERMISSOES } from '../../../lib/permissoes/permissoes';
import { elementoValido } from '../../../lib/projetos/projetos';
import { ancestrais, montarEntrada, useEditorStore } from '../../../store/editorStore';
import ArvoreElementos from './ArvoreElementos';
import AcoesModulos from './AcoesModulos';
import BarraFerramentas from './BarraFerramentas';
import PainelElemento from './PainelElemento';
import styles from './ProjetoEditor.module.css';
import VariaveisGlobaisDialog from './VariaveisGlobaisDialog';
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

export default function ProjetoEditor() {
  const projetoId = Number(useParams().id);
  const consulta = useProjeto(projetoId);
  const salvar = useSalvarElementos(projetoId);
  const [estruturaAberta, setEstruturaAberta] = useState(true);
  const idPainelEstrutura = useId();
  const celular = useCelular();
  // No celular, cada seleção nova nasce com o painel de propriedades fechado (o usuário abre se
  // quiser); no computador ele sempre abre, como já era
  const [propriedadesAbertasPara, setPropriedadesAbertasPara] = useState<string | null>(null);
  const [ultimaSelecionadaVista, setUltimaSelecionadaVista] = useState<string | null>(null);
  const [variaveisGlobaisAberto, setVariaveisGlobaisAberto] = useState(false);

  const projetoCarregado = useEditorStore((s) => s.projetoId);
  const planta = useEditorStore((s) => s.planta);
  const elementos = useEditorStore((s) => s.elementos);
  const selecionada = useEditorStore((s) => s.selecionada);
  const selecionadasExtra = useEditorStore((s) => s.selecionadasExtra);
  const contexto = useEditorStore((s) => s.contexto);
  const ferramenta = useEditorStore((s) => s.ferramenta);
  const explodido = useEditorStore((s) => s.explodido);
  const definirDistanciaExplosao = useEditorStore((s) => s.definirDistanciaExplosao);
  const fecharExplosao = useEditorStore((s) => s.fecharExplosao);
  const alterado = useEditorStore((s) => s.alterado);
  const carregar = useEditorStore((s) => s.carregar);
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

  // Esvazia o editor ao sair, para não reaproveitar elementos de outro projeto
  useEffect(() => limpar, [limpar]);

  // Carrega o projeto uma única vez; depois disso o estado do editor é a fonte da verdade
  useEffect(() => {
    if (consulta.data && useEditorStore.getState().projetoId !== consulta.data.id) {
      carregar(consulta.data);
      { const q = new URLSearchParams(location.search).get('sel'); if (q) setTimeout(() => { const st = useEditorStore.getState(); const c = Object.values(st.elementos).find((e) => e.tipo === q); if (c) st.selecionar(c.chave); }, 50); }
    }
  }, [consulta.data, carregar]);

  // Trocar de seleção fecha o painel de novo, pra cada módulo clicado no celular nascer oculto
  // (ajuste de estado durante a renderização, não em efeito: React recomenda isso pra estado que
  // só depende de uma prop/valor ter mudado, evitando uma renderização extra desnecessária)
  if (selecionada !== ultimaSelecionadaVista) {
    setUltimaSelecionadaVista(selecionada);
    setPropriedadesAbertasPara(null);
  }

  const mostrarPropriedades = selecionada !== null && (!celular || propriedadesAbertasPara === selecionada);

  const listaElementos = Object.values(elementos);
  const todosValidos = listaElementos.every((e) => elementoValido(e, e.pai ? elementos[e.pai]?.parede : undefined));
  const podeEditarElementos = useTemPermissao(PERMISSOES.PROJETOS_EDITAR_ELEMENTOS);
  const podeVariaveisGlobais = useTemPermissao(PERMISSOES.PROJETO_VARIAVEIS_GLOBAIS);
  const podeSalvar = alterado && todosValidos && !salvar.isPending && podeEditarElementos;

  function salvarAlteracoes() {
    if (!podeSalvar) return;
    const estado = useEditorStore.getState();
    salvar.mutate(
      { elementos: montarEntrada(estado), variaveisGlobais: estado.variaveisGlobais },
      { onSuccess: (projeto) => carregar(projeto, true) },
    );
  }

  // Atalhos: Ctrl+S / Cmd+S salva, Ctrl+Z desfaz e Ctrl+Shift+Z (ou Ctrl+Y) refaz, mesmo fora de
  // campos de texto (mas Ctrl+Z num campo de texto é o desfazer nativo dele, não o do projeto).
  // Fora de campos de texto, Esc limpa a seleção e depois sai do grupo, Delete remove o
  // selecionado, V ativa Selecionar, M ativa Mover, Q ativa Girar, P ativa o construtor de
  // paredes, T ativa a trena e B ativa o balde de tinta. Com o construtor de paredes, a trena
  // ou o balde ativos, cada um tem os próprios atalhos/cliques (ver ModuloViewport.tsx) e os
  // daqui não se aplicam
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
        else sair();
      } else if (tecla === 'delete' && selecionada) {
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

  // Avisa antes de sair com alterações não salvas: navegação interna...
  const bloqueio = useBlocker(
    ({ currentLocation, nextLocation }) =>
      alterado && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (bloqueio.state !== 'blocked') return;
    if (window.confirm('Há alterações não salvas. Sair mesmo assim?')) bloqueio.proceed();
    else bloqueio.reset();
  }, [bloqueio]);

  // ...e fechar ou recarregar a aba
  useEffect(() => {
    if (!alterado) return;
    const aoSairDaPagina = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', aoSairDaPagina);
    return () => window.removeEventListener('beforeunload', aoSairDaPagina);
  }, [alterado]);

  if (!Number.isInteger(projetoId) || consulta.isError) {
    const naoEncontrado =
      !Number.isInteger(projetoId) || (consulta.error instanceof ApiError && consulta.error.status === 404);
    return (
      <div className={styles.aviso} role="alert">
        <p>
          {naoEncontrado
            ? 'Projeto não encontrado.'
            : `Não foi possível carregar o projeto: ${consulta.error?.message}`}
        </p>
        <Link to="/projetos">Voltar para projetos</Link>
      </div>
    );
  }

  if (projetoCarregado !== projetoId) {
    return (
      <div className={styles.aviso}>
        <p>Carregando projeto…</p>
      </div>
    );
  }

  const status = salvar.isPending
    ? 'Salvando…'
    : !todosValidos
      ? 'Corrija os elementos marcados para salvar'
      : alterado
        ? 'Alterações não salvas'
        : 'Tudo salvo';

  // Caminho do grupo aberto, da raiz até ele
  const caminhoContexto = contexto ? [...ancestrais(elementos, contexto).reverse(), contexto] : [];

  return (
    <div className={styles.editor}>
      <header className={styles.topo}>
        <VoltarLink to="/projetos">Projetos</VoltarLink>
        <div className={styles.titulo}>
          <h1 className={styles.nome}>{consulta.data?.nome}</h1>
        </div>
        <span className={`${styles.divisor} ${styles.divisorFerramentas}`} aria-hidden="true" />
        <BarraFerramentas />
        <AcoesModulos />
        {podeVariaveisGlobais && (
          <>
            <span className={`${styles.divisor} ${styles.divisorFerramentas}`} aria-hidden="true" />
            <div role="group" aria-label="Variáveis globais" className={styles.grupoFerramentas}>
              <button
                type="button"
                className={styles.ferramenta}
                aria-label="Variáveis globais do projeto"
                title="Variáveis globais do projeto"
                onClick={() => setVariaveisGlobaisAberto(true)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
                </svg>
              </button>
            </div>
          </>
        )}
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
        {podeEditarElementos && (
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

      {caminhoContexto.length > 0 && (
        <nav aria-label="Editando dentro de" className={`${styles.flutuante} ${styles.trilhaCard}`}>
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

      {estruturaAberta && (
        <aside
          id={idPainelEstrutura}
          className={`${styles.flutuante} ${styles.painel} ${styles.painelEstrutura} ${caminhoContexto.length > 0 ? styles.painelComTrilha : ''}`}
          aria-label="Estrutura do projeto"
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
            {/* No celular, fechar só esconde o painel de novo (o módulo continua selecionado,
                então mover/girar continuam funcionando); no computador, fechar desseleciona */}
            <PainelElemento onFechar={() => (celular ? setPropriedadesAbertasPara(null) : selecionar(null))} />
          </fieldset>
        </aside>
      )}

      {/* Parede/trena/pintura já ocupam a parte de baixo da tela com a própria barra de ações
          (ver .barraParede em ModuloViewport) — "Ver propriedades" ali só brigaria por espaço */}
      {celular &&
        selecionada &&
        !mostrarPropriedades &&
        ferramenta !== 'parede' &&
        ferramenta !== 'trena' &&
        ferramenta !== 'pintura' && (
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
          planta={planta}
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

      <VariaveisGlobaisDialog aberto={variaveisGlobaisAberto} onFechar={() => setVariaveisGlobaisAberto(false)} />
    </div>
  );
}
