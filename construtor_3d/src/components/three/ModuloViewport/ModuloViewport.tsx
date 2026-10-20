import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  DirectionalLight,
  GridHelper,
  Group,
  type Intersection,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Plane,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import CampoMedida from '../../ui/CampoMedida/CampoMedida';
import { FACES_TEXTURA, facesDaForma, parametrosValidos } from '../../../lib/formas/formas';
import { formatarCm } from '../../../lib/medidas/medidas';
import {
  LIMITE_POSICAO,
  MEDIDA_MAXIMA,
  MEDIDA_MINIMA,
  PAREDE_COMPRIMENTO_MAXIMO,
  paredeValida,
  pisoValido,
  type Posicao,
  type Rotacao,
} from '../../../lib/projetos/projetos';
import { useImportacaoAutomaticaTexturas } from '../../../lib/hooks/useImportacaoAutomaticaTexturas';
import { useTexturas } from '../../../lib/hooks/useTexturas';
import { ehCorSolida, lerTexturaJpeg } from '../../../lib/textura/textura';
import {
  type AlinhamentoParede,
  alvoEdicaoParede,
  anguloGraus,
  aplicarEngatesNasPontas,
  calcularEncaixe,
  construirSegmentosParede,
  deslocamentoExplosaoRecursivo,
  deslocarTrechoParaOEixo,
  distanciaXY,
  type ElementoEditor,
  type EngateParede,
  estaDentro,
  type Ferramenta,
  pontosDoEixoDaParede,
} from '../../../store/editorStore';
import styles from './ModuloViewport.module.css';
import {
  atualizarEtiquetasDistanciaDoArraste,
  haColisao,
  haColisaoDeslocada,
  reancorarArraste,
} from './colisao';
import {
  COMPRIMENTO_MINIMO_EIXOS,
  COR_DESTAQUE_GRUPO,
  COR_DESTAQUE_OBJETO,
  COR_MANIPULADOR_ATIVO,
  COR_SELECIONADA,
  CORES_EIXOS,
  COR_TRENA,
  ESPESSURA_PADRAO_PAREDE,
  LIMIAR_FECHAR_CONTORNO,
  PASSO_MOVIMENTO,
  PASSO_ROTACAO,
  PE_DIREITO_PADRAO,
  RAIO_MARCADOR_TRENA,
  SENTIDO_Z,
  TOLERANCIA_CLIQUE,
} from './constantes';
import {
  indiceSegmentoProximo,
  indiceVerticeProximo,
  moverOuFundirVertice,
  travarNaLinhaReta,
  travarVerticeArrastado,
  verticeMaisProximo,
  verticesVisiveis,
} from './construtorParedes';
import {
  atualizarSala,
  criarDesenhoParede,
  criarDesenhoTrena,
  criarEixos,
  criarSala,
  descartarDesenhoParede,
  descartarDesenhoTrena,
  descartarEixos,
  descartarSala,
} from './desenhos';
import {
  ajustarModelo,
  aplicarAparencia,
  atualizarCaixaGrupo,
  chaveModelo3d,
  definirEtiqueta,
  definirForma,
  definirModelo3d,
  definirTexturas,
  descartarObjeto,
  faceClicada,
} from './malhas';
import { criarGeometriaParede, definirParede, definirPiso } from './paredes';
import { type Cena, type ObjetoElemento } from './tipos';
import {
  aplicarRotacao,
  distancia3D,
  limitarPosicao,
  limparEtiquetas,
  limparGeometrias,
  limparMalhasProprias,
  malhasVisiveis,
  ponteiroNormalizado,
  rotacaoDaCena,
} from './utilitarios';
import { ajustarPlanosDeCorte, enquadrar, ORDEM_DAS_VISTAS, type VistaId, VISTAS } from './vistas';

interface ModuloViewportProps {
  elementos: Record<string, ElementoEditor>;
  /** Planta do ambiente (X largura, Y pé-direito, Z profundidade); nula em projetos antigos */
  planta: Posicao | null;
  selecionada: string | null;
  /** Demais elementos selecionados junto de `selecionada` (Ctrl/Cmd+Click); recebem o mesmo
   * destaque dela, mas não o gizmo de mover/girar (esse continua só na primária) */
  selecaoExtra: string[];
  contexto: string | null;
  ferramenta: Ferramenta;
  /** Vista Explodida ativa (afasta os filhos diretos de `explodido.chave` do centro dele) */
  explodido: { chave: string; distancia: number } | null;
  /** `comCtrl`: Ctrl/Cmd estava pressionado no clique (alterna a seleção múltipla, em vez de
   * substituir a seleção) */
  onClicarPeca: (chavePeca: string | null, comCtrl: boolean) => void;
  onDuploCliquePeca: (chavePeca: string) => void;
  /** Arraste das setas (posição) ou dos anéis (rotação) */
  onTransformar: (chave: string, alteracao: { posicao?: Posicao; rotacao?: Rotacao }) => void;
  /**
   * Desenho de paredes concluído (Enter ou fechando o contorno), com os cantos e se fechou o
   * contorno; `chaveAlvo` é o grupo de paredes ou a parede avulsa sendo reeditada, ou null quando
   * é um desenho novo. `engateInicio`/`engateFim`: a ponta correspondente (só faz sentido num
   * contorno aberto) foi encostada numa parede já existente — ver EngateParede no editorStore
   */
  onConcluirParedes: (
    pontos: Posicao[],
    fechado: boolean,
    opcoes: { altura: number; espessura: number },
    chaveAlvo: string | null,
    engateInicio?: EngateParede,
    engateFim?: EngateParede,
  ) => void;
  onCancelarParede: () => void;
  onPintarFace: (chave: string, face: string, imagem: string | null) => void;
  /** Aplica (ou, com `null`, remove) uma textura em todas as faces de um grupo de uma vez — ver
   * `Elemento.gruposDeFace` */
  onPintarGrupo: (chave: string, nomeGrupo: string, imagem: string | null) => void;
}

export default function ModuloViewport({
  elementos,
  planta,
  selecionada,
  selecaoExtra,
  contexto,
  ferramenta,
  explodido,
  onClicarPeca,
  onDuploCliquePeca,
  onTransformar,
  onConcluirParedes,
  onCancelarParede,
  onPintarFace,
  onPintarGrupo,
}: ModuloViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputImagemTintaRef = useRef<HTMLInputElement>(null);
  const cenaRef = useRef<Cena | null>(null);
  const objetosRef = useRef(new Map<string, ObjetoElemento>());
  const enquadradoRef = useRef(false);
  const callbacksRef = useRef({
    onClicarPeca,
    onDuploCliquePeca,
    onTransformar,
    onConcluirParedes,
    onCancelarParede,
    onPintarFace,
  });
  // Espelha a prop `elementos` para o listener de arraste (criado uma única vez) sempre ler
  // a árvore mais recente, e não a do momento em que a cena foi montada
  const elementosRef = useRef(elementos);
  // Idem para a ferramenta ativa: o clique/duplo clique de seleção (criado uma única vez) não
  // deve fazer nada enquanto o construtor de paredes estiver desenhando no piso
  const ferramentaRef = useRef(ferramenta);
  // Última posição do arraste sem colisão, para "segurar" o elemento nela ao encostar num sólido
  const ultimaPosicaoValidaRef = useRef(new Vector3());
  // Shift segurado: a colisão do elemento movido fica desativada até soltar (ver objectChange)
  const shiftSeguradoRef = useRef(false);
  useEffect(() => {
    const atualizar = (e: KeyboardEvent | PointerEvent) => {
      shiftSeguradoRef.current = e.shiftKey;
    };
    const soltar = () => {
      shiftSeguradoRef.current = false;
    };
    // pointermove em captura: roda antes do TransformControls tratar o mesmo movimento
    window.addEventListener('keydown', atualizar);
    window.addEventListener('keyup', atualizar);
    window.addEventListener('pointermove', atualizar, true);
    window.addEventListener('blur', soltar);
    return () => {
      window.removeEventListener('keydown', atualizar);
      window.removeEventListener('keyup', atualizar);
      window.removeEventListener('pointermove', atualizar, true);
      window.removeEventListener('blur', soltar);
    };
  }, []);

  // Construtor de paredes: cantos já confirmados (clique a clique) e ponto sob o mouse no piso,
  // ambos em coordenadas de dados (mm, y sempre 0); zerados sempre que a ferramenta muda
  const [pontosParede, setPontosParede] = useState<Posicao[]>([]);
  const [mouseNoChao, setMouseNoChao] = useState<Posicao | null>(null);
  const [espessuraParede, setEspessuraParede] = useState(ESPESSURA_PADRAO_PAREDE);
  // Em que ponto da espessura os cantos clicados ficam: no eixo da parede (central) ou numa das faces.
  // Só vale ao desenhar do zero; reeditar um contorno já pronto trabalha direto no eixo (ver abaixo)
  const [alinhamentoSelecionado, setAlinhamentoSelecionado] = useState<AlinhamentoParede>('central');
  // Campo "Distância": Ctrl foca ele sem precisar clicar (ver aoTeclar), mantendo a direção que o
  // cursor já está apontando — só digita o comprimento e Enter
  const distanciaParedeInputRef = useRef<HTMLInputElement>(null);
  // Já digitou algo no campo de extensão desde que ele ganhou o foco? Enquanto não, Enter e Esc
  // continuam valendo como atalhos da ferramenta (concluir / cancelar) mesmo com o campo focado
  const digitouNaExtensaoRef = useRef(false);
  // Vértice sendo arrastado no momento (posição provisória, só aplicada de verdade ao soltar);
  // separado de `pontosParede` pra não precisar recriar os listeners de ponteiro a cada quadro
  const [verticeArrastado, setVerticeArrastado] = useState<{ indice: number; posicao: Posicao } | null>(null);
  // Chave do grupo de paredes (ou parede avulsa) sendo reeditado, se a ferramenta foi ativada com
  // um deles selecionado; null quando é um desenho novo
  const [chaveEdicaoParede, setChaveEdicaoParede] = useState<string | null>(null);
  // Se o traçado começou fechado (reeditando um contorno fechado) — Enter/Concluir preservam isso
  const [fechadoInicial, setFechadoInicial] = useState(false);
  // Altura das paredes sendo reeditadas (a delas mesmas, não a da planta); null num desenho novo
  const [alturaEdicaoParede, setAlturaEdicaoParede] = useState<number | null>(null);
  // Parede interna: a ponta correspondente (primeiro/último ponto de uma cadeia ABERTA) foi
  // clicada em cima de outra parede já existente, e vai se encostar na face dela (T de verdade) em
  // vez de ficar solta no ar — ver EngateParede/aplicarEngatesNasPontas
  const [engateInicio, setEngateInicio] = useState<EngateParede | null>(null);
  const [engateFim, setEngateFim] = useState<EngateParede | null>(null);
  const arrastandoIndiceRef = useRef<number | null>(null);

  // Trena: pontos já marcados (clique a clique, em coordenadas de dados) e o ponto sob o mouse
  // no momento, pra desenhar o segmento "elástico" até ele; zerados sempre que a ferramenta muda
  const [pontosTrena, setPontosTrena] = useState<Posicao[]>([]);
  const [mouseTrena, setMouseTrena] = useState<Posicao | null>(null);

  // Balde de tinta: a "tinta" carregada no momento (cor sólida ou imagem importada) — clicar numa
  // face pintável aplica ela ali. `imagemTinta` guarda o resultado já pronto de lerTexturaJpeg
  // (não o File), pra não reprocessar a cada clique
  const [modoTinta, setModoTinta] = useState<'cor' | 'imagem' | 'remover'>('cor');
  const [corTinta, setCorTinta] = useState('#c9c2b4');
  const [imagemTinta, setImagemTinta] = useState<string | null>(null);
  const [nomeImagemTinta, setNomeImagemTinta] = useState<string | null>(null);
  const [erroTinta, setErroTinta] = useState<string | null>(null);
  const [carregandoImagemTinta, setCarregandoImagemTinta] = useState(false);
  // Texturas já usadas antes, oferecidas na própria grade do painel de pintura (sem precisar de
  // um diálogo à parte) — ativo só com o modo "Imagem" aberto, pra não buscar/importar à toa
  const painelDeImagemAberto = ferramenta === 'pintura' && modoTinta === 'imagem';
  const texturasSalvas = useTexturas();
  const importandoTexturaAutomaticamente = useImportacaoAutomaticaTexturas(painelDeImagemAberto);
  // Foco num módulo (peça ou grupo): esconde tudo que não for ele, um ancestral dele (só pra
  // hierarquia de containers renderizar, ver o efeito de sincronização) ou algo dentro dele —
  // só na visualização (não mexe em elemento.visivel, não marca o projeto como alterado)
  const [chaveEmFoco, setChaveEmFoco] = useState<string | null>(null);

  // Vista do botão Enquadrar (o menu ao lado escolhe; o botão repete a última escolhida)
  const [vistaDoEnquadramento, setVistaDoEnquadramento] = useState<VistaId>('isometrica');
  const [menuDeVistasAberto, setMenuDeVistasAberto] = useState(false);
  const vistasRef = useRef<HTMLDivElement>(null);
  const menuVistasRef = useRef<HTMLDivElement>(null);
  // O menu é desenhado num portal no <body>, fora do viewport: o viewport é um contexto de
  // empilhamento próprio (z-index 0, abaixo dos painéis laterais), então um menu de dentro dele
  // ficaria por baixo do painel de propriedades. Daí a posição fixa, calculada a partir do botão
  const [posicaoMenuVistas, setPosicaoMenuVistas] = useState<{ direita: number; baixo: number } | null>(null);
  function alternarMenuDeVistas() {
    if (menuDeVistasAberto) {
      setMenuDeVistasAberto(false);
      return;
    }
    const caixa = vistasRef.current?.getBoundingClientRect();
    if (!caixa) return;
    setPosicaoMenuVistas({ direita: window.innerWidth - caixa.right, baixo: window.innerHeight - caixa.top + 6 });
    setMenuDeVistasAberto(true);
  }
  useEffect(() => {
    if (!menuDeVistasAberto) return;
    const fechar = () => setMenuDeVistasAberto(false);
    const fecharAoClicarFora = (e: PointerEvent) => {
      const alvo = e.target as Node;
      if (!vistasRef.current?.contains(alvo) && !menuVistasRef.current?.contains(alvo)) fechar();
    };
    const fecharComEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('pointerdown', fecharAoClicarFora);
    document.addEventListener('keydown', fecharComEsc);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('pointerdown', fecharAoClicarFora);
      document.removeEventListener('keydown', fecharComEsc);
      window.removeEventListener('resize', fechar);
    };
  }, [menuDeVistasAberto]);

  const selecaoExtraRef = useRef(selecaoExtra);

  useEffect(() => {
    elementosRef.current = elementos;
    selecaoExtraRef.current = selecaoExtra;
  }, [elementos, selecaoExtra]);

  // Sai do foco sozinho se o módulo focado deixar de existir (excluído, ou undo/redo) — senão a
  // condição de foco nunca bate com nada e a cena inteira fica escondida
  useEffect(() => {
    if (chaveEmFoco && !elementos[chaveEmFoco]) setChaveEmFoco(null);
  }, [elementos, chaveEmFoco]);

  useEffect(() => {
    ferramentaRef.current = ferramenta;
  }, [ferramenta]);

  useEffect(() => {
    callbacksRef.current = { onClicarPeca, onDuploCliquePeca, onTransformar, onConcluirParedes, onCancelarParede, onPintarFace };
  }, [onClicarPeca, onDuploCliquePeca, onTransformar, onConcluirParedes, onCancelarParede, onPintarFace]);

  // Ativar a ferramenta de paredes com um grupo de paredes (ou uma parede dele, ou uma parede
  // avulsa) selecionado carrega os cantos dele pra reeditar, em vez de começar um desenho vazio
  useEffect(() => {
    if (ferramenta !== 'parede') {
      setPontosParede([]);
      setMouseNoChao(null);
      setVerticeArrastado(null);
      setChaveEdicaoParede(null);
      setAlturaEdicaoParede(null);
      setEngateInicio(null);
      setEngateFim(null);
      return;
    }
    const alvo = alvoEdicaoParede(elementos, selecionada);
    setPontosParede(alvo?.pontos ?? []);
    setFechadoInicial(alvo?.fechado ?? false);
    setChaveEdicaoParede(alvo?.chave ?? null);
    setAlturaEdicaoParede(alvo?.altura ?? null);
    setEngateInicio(null);
    setEngateFim(null);
    if (alvo) setEspessuraParede(alvo.espessura);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramenta]);

  // Trocar de ferramenta sempre limpa a trena (ela não guarda nada entre uma ativação e outra)
  useEffect(() => {
    if (ferramenta !== 'trena') {
      setPontosTrena([]);
      setMouseTrena(null);
    }
  }, [ferramenta]);

  // Monta a cena uma única vez
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const objetos = objetosRef.current;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    // Limitado a 2: celulares chegam a 3 e o buffer do canvas cresce com o quadrado disso, o que
    // facilita o navegador derrubar o contexto WebGL ao redimensionar (abrir/fechar uma gaveta)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    // Sem o preventDefault o navegador nunca restaura um contexto WebGL perdido (comum em celular, com
    // a aba em segundo plano ou pouca memória) e o canvas fica branco pra sempre; com ele, o próprio
    // three.js refaz o estado quando o contexto volta e o laço de animação continua desenhando
    const aoPerderContexto = (e: Event) => e.preventDefault();
    renderer.domElement.addEventListener('webglcontextlost', aoPerderContexto);

    // Etiquetas dos módulos (ver definirEtiqueta): um <div> por cima do canvas, com um <div>
    // sobreposto por etiqueta, posicionado a cada quadro pelo próprio CSS2DRenderer
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.inset = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    container.appendChild(labelRenderer.domElement);

    const scene = new Scene();
    scene.add(new AmbientLight(0xffffff, 0.8));
    const luz = new DirectionalLight(0xffffff, 1.6);
    luz.position.set(3000, 5000, 4000);
    scene.add(luz);

    // Grade de referência: cobre bem além do limite de posição (LIMITE_POSICAO), pra nunca faltar
    // grade embaixo de uma peça movida pro fim do espaço válido; divisões de 100 mm, como antes
    const TAMANHO_GRADE = LIMITE_POSICAO * 3;
    const piso = new GridHelper(TAMANHO_GRADE, TAMANHO_GRADE / 100, 0x888888, 0x888888);
    piso.material.transparent = true;
    piso.material.opacity = 0.3;
    scene.add(piso);

    const camera = new PerspectiveCamera(45, 1, 10, 100000);
    camera.position.set(2000, 1600, 2600);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    // Sem isso, a roda do mouse sempre aproxima/afasta em direção ao centro do orbit (`target`),
    // não de onde o cursor está — dentro de uma sala (paredes bem perto da câmera), isso faz o
    // zoom "puxar" pro lado errado o tempo todo
    controls.zoomToCursor = true;
    controls.target.set(0, 400, 0);
    controls.update();
    // Zoom e giro mudam a distância até o alvo: os planos de corte vão junto (ver vistas.ts)
    controls.addEventListener('change', () => ajustarPlanosDeCorte(camera, controls.target));

    const raiz = new Group();
    scene.add(raiz);

    // Piso e caixa tracejada da planta do ambiente, ocultos até `planta` chegar do projeto
    const sala = criarSala();
    scene.add(sala.grupo);

    // Pré-visualização do construtor de paredes, desenhada direto no piso
    const parede = criarDesenhoParede();
    scene.add(parede.grupo);

    // Pré-visualização da trena
    const trena = criarDesenhoTrena();
    scene.add(trena.grupo);

    // Etiquetas de distância até o vizinho colidível mais próximo, mostradas só durante o
    // arraste de um elemento com colisão ativada pela ferramenta Mover (ver objectChange abaixo)
    const distancias = new Group();
    distancias.visible = false;
    scene.add(distancias);

    // Setas de X, Y e Z para mover o elemento selecionado
    const transform = new TransformControls(camera, renderer.domElement);
    transform.setTranslationSnap(PASSO_MOVIMENTO);
    transform.setRotationSnap(MathUtils.degToRad(PASSO_ROTACAO));
    // Enquanto arrasta uma seta, a câmera não gira; ao começar, guarda a posição de partida
    // (sem colisão, já que o elemento estava parado ali) para poder voltar a ela se precisar
    transform.addEventListener('dragging-changed', (e) => {
      controls.enabled = !e.value;
      if (e.value && transform.object) ultimaPosicaoValidaRef.current.copy(transform.object.position);
      if (!e.value) {
        limparEtiquetas(distancias);
        distancias.visible = false;
      }
    });
    transform.addEventListener('objectChange', () => {
      const alvo = transform.object;
      if (!alvo) return;
      const chave = alvo.userData.chave as string;

      // Posição e rotação do contêiner já são relativas ao pai, como guardadas no elemento
      if (transform.mode === 'rotate') {
        callbacksRef.current.onTransformar(chave, { rotacao: rotacaoDaCena(alvo) });
        return;
      }

      alvo.position.set(
        limitarPosicao(alvo.position.x),
        limitarPosicao(alvo.position.y),
        limitarPosicao(alvo.position.z),
      );

      // Os outros elementos da seleção múltipla (e tudo que está dentro deles: um módulo é um grupo
      // de várias peças, cada uma sólida) se movem junto com este, como um conjunto: entre si não
      // há colisão, medição de espaço nem encaixe — senão arrastar um contra o outro travaria e
      // mostraria 0 cm. O conjunto inteiro colide com o que está FORA da seleção (ver abaixo)
      const todos = elementosRef.current;
      const raizesCompanheiras = selecaoExtraRef.current.filter((c) => c !== chave && todos[c]);
      const companheiros = new Set(
        // As cópias do próprio elemento (dobradiças, prateleiras...) não contam como obstáculo dele
        Object.keys(todos).filter((c) => {
          const referencia = todos[chave].referenciaEstavel;
          const copiaDoMovido = !!referencia && todos[c].copiaDe === referencia && todos[c].pai === todos[chave].pai;
          return c !== chave && (copiaDoMovido || raizesCompanheiras.some((r) => estaDentro(todos, c, r)));
        }),
      );
      const semColisao = (conjunto: Set<string>): Record<string, ElementoEditor> =>
        Object.fromEntries(Object.entries(todos).map(([c, e]) => [c, conjunto.has(c) ? { ...e, colisao: false } : e]));
      const elementosAtuais = companheiros.size ? semColisao(companheiros) : todos;

      // Encaixe: gruda numa face de um irmão do mesmo grupo, se estiver perto o bastante. Z dos
      // dados é o Y nativo da cena (altura); Y dos dados é o Z nativo (profundidade, espelhado)
      const posicaoBruta = { x: alvo.position.x, y: (SENTIDO_Z * alvo.position.z) || 0, z: alvo.position.y };
      const posicaoComEncaixe = calcularEncaixe({ elementos: elementosAtuais, filhos: {} }, chave, posicaoBruta, companheiros);
      alvo.position.set(posicaoComEncaixe.x, posicaoComEncaixe.z, SENTIDO_Z * posicaoComEncaixe.y);

      // Colisão: barra o movimento que sobreporia outro elemento também sólido. Vale pro elemento e,
      // numa seleção múltipla, pro conjunto todo: cada elemento da seleção, deslocado do mesmo tanto
      // que o principal, não pode bater em nada fora da seleção
      let ambienteDoConjunto: Record<string, ElementoEditor> | null = null;
      const colide = () => {
        // Shift: atravessa tudo, como se o elemento não tivesse colisão enquanto for segurado
        if (shiftSeguradoRef.current) return false;
        alvo.updateWorldMatrix(true, true);
        if (haColisao(objetosRef.current, elementosAtuais, chave, alvo)) return true;
        if (raizesCompanheiras.length === 0 || !alvo.parent) return false;

        const deslocamento = alvo.parent
          .localToWorld(alvo.position.clone())
          .sub(alvo.parent.localToWorld(ultimaPosicaoValidaRef.current.clone()));
        ambienteDoConjunto ??= semColisao(
          new Set([...companheiros, chave, ...Object.keys(todos).filter((c) => estaDentro(todos, c, chave))]),
        );
        return raizesCompanheiras.some((c) =>
          haColisaoDeslocada(objetosRef.current, ambienteDoConjunto as Record<string, ElementoEditor>, !!todos[c].colisao, c, deslocamento),
        );
      };

      if (colide()) {
        // Em vez de voltar pra posição do evento anterior (o que deixava um vão do tamanho do passo
        // do mouse, maior quanto mais rápido o arraste), encosta no obstáculo: eixo por eixo, a
        // partir da última posição livre, vai até onde der — tenta o eixo inteiro e, se bater,
        // procura por bissecção o ponto mais longe ainda livre. Eixo por eixo também deixa o
        // elemento deslizar ao longo de uma parede em vez de travar
        const proposta = alvo.position.clone();
        const aceita = ultimaPosicaoValidaRef.current.clone();
        for (const eixo of ['x', 'y', 'z'] as const) {
          alvo.position.copy(aceita);
          alvo.position[eixo] = proposta[eixo];
          if (!colide()) {
            aceita[eixo] = proposta[eixo];
            continue;
          }
          let livre = aceita[eixo];
          let batida = proposta[eixo];
          for (let i = 0; i < 16; i++) {
            const meio = (livre + batida) / 2;
            alvo.position.copy(aceita);
            alvo.position[eixo] = meio;
            if (colide()) batida = meio;
            else livre = meio;
          }
          aceita[eixo] = livre;
        }
        alvo.position.copy(aceita);
        alvo.updateWorldMatrix(true, true);
        reancorarArraste(transform, alvo.position);
      }

      ultimaPosicaoValidaRef.current.copy(alvo.position);
      atualizarEtiquetasDistanciaDoArraste(distancias, objetosRef.current, elementosAtuais, chave, alvo, styles.etiquetaDistancia);

      callbacksRef.current.onTransformar(chave, {
        posicao: { x: alvo.position.x, y: (SENTIDO_Z * alvo.position.z) || 0, z: alvo.position.y },
      });
    });
    transform.setColors(CORES_EIXOS[0], CORES_EIXOS[1], CORES_EIXOS[2], COR_MANIPULADOR_ATIVO);
    scene.add(transform.getHelper());

    // Eixos do ambiente na origem, 1 mm acima do piso para não disputar com a grade; vão até a
    // borda da própria grade (metade do tamanho dela), não só até o limite de posição das peças
    const eixosAmbiente = criarEixos(false);
    eixosAmbiente.scale.setScalar(TAMANHO_GRADE / 2);
    eixosAmbiente.position.y = 1;
    scene.add(eixosAmbiente);

    // Eixos da seleção (ou do grupo aberto); a posição acompanha o alvo a cada quadro
    const eixosSelecao = criarEixos(true);
    eixosSelecao.visible = false;
    scene.add(eixosSelecao);

    const cena: Cena = {
      camera,
      controls,
      transform,
      renderer,
      raiz,
      sala,
      eixosAmbiente,
      eixosSelecao,
      alvoEixos: null,
      parede,
      trena,
    };
    cenaRef.current = cena;
    enquadradoRef.current = false;

    const redimensionar = () => {
      const { clientWidth: largura, clientHeight: altura } = container;
      // Contêiner sem tamanho (ex.: escondido ou espremido): mantém o último tamanho bom, senão o
      // aspecto vira Infinity/NaN e a câmera para de renderizar
      if (largura === 0 || altura === 0) return;
      renderer.setSize(largura, altura);
      labelRenderer.setSize(largura, altura);
      camera.aspect = largura / altura;
      camera.updateProjectionMatrix();
      // Redimensionar o canvas o limpa: redesenha já, em vez de esperar o próximo quadro do laço
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    const observer = new ResizeObserver(redimensionar);
    observer.observe(container);
    redimensionar();

    const raycaster = new Raycaster();
    const pecaSobPonteiro = (e: MouseEvent) => {
      const ponteiro = ponteiroNormalizado(e, renderer.domElement);
      raycaster.setFromCamera(ponteiro, camera);
      const [acerto] = raycaster.intersectObjects(malhasVisiveis(objetos), false);
      return (acerto?.object.userData.chave as string | undefined) ?? null;
    };

    // Clique sem arrastar seleciona (ou limpa a seleção); clique nas setas não conta. Com o
    // construtor de paredes ativo, esses cliques são tratados por outro efeito (ver abaixo)
    const inicioClique = new Vector2();
    let clicouNasSetas = false;
    const aoPressionar = (e: PointerEvent) => {
      inicioClique.set(e.clientX, e.clientY);
      clicouNasSetas = transform.axis !== null;
    };
    const aoSoltar = (e: PointerEvent) => {
      if (ferramentaRef.current === 'parede' || ferramentaRef.current === 'trena' || ferramentaRef.current === 'pintura' || clicouNasSetas) return;
      if (inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE) return;
      callbacksRef.current.onClicarPeca(pecaSobPonteiro(e), e.ctrlKey || e.metaKey);
    };
    const aoDuploClique = (e: MouseEvent) => {
      if (ferramentaRef.current === 'parede' || ferramentaRef.current === 'trena' || ferramentaRef.current === 'pintura') return;
      const chave = pecaSobPonteiro(e);
      if (chave) callbacksRef.current.onDuploCliquePeca(chave);
    };
    renderer.domElement.addEventListener('pointerdown', aoPressionar);
    renderer.domElement.addEventListener('pointerup', aoSoltar);
    renderer.domElement.addEventListener('dblclick', aoDuploClique);

    // O three.js só agenda o próximo quadro DEPOIS de executar este callback: uma exceção num único
    // quadro (geometria inválida, textura que falhou...) mataria o laço pra sempre e o canvas ficaria
    // congelado — e branco depois do próximo redimensionamento. Por isso o try/catch: o erro vai
    // pro console (uma vez por mensagem, pra não inundar) e o laço segue
    const errosJaVistos = new Set<string>();
    renderer.setAnimationLoop(() => {
      try {
        controls.update();
        // Mantém os eixos na origem do alvo, inclusive durante o arraste das setas
        cena.alvoEixos?.getWorldPosition(eixosSelecao.position);
        cena.alvoEixos?.getWorldQuaternion(eixosSelecao.quaternion);
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);
      } catch (erro) {
        const mensagem = erro instanceof Error ? erro.message : String(erro);
        if (!errosJaVistos.has(mensagem)) {
          errosJaVistos.add(mensagem);
          console.error('Erro ao desenhar um quadro da cena 3D (o desenho continua):', erro);
        }
      }
    });

    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost', aoPerderContexto);
      renderer.domElement.removeEventListener('pointerdown', aoPressionar);
      renderer.domElement.removeEventListener('pointerup', aoSoltar);
      renderer.domElement.removeEventListener('dblclick', aoDuploClique);
      observer.disconnect();
      transform.detach();
      transform.getHelper().removeFromParent();
      transform.dispose();
      controls.dispose();
      for (const objeto of objetos.values()) descartarObjeto(objeto);
      objetos.clear();
      piso.geometry.dispose();
      piso.material.dispose();
      descartarSala(sala);
      descartarDesenhoParede(parede);
      descartarDesenhoTrena(trena);
      distancias.removeFromParent();
      limparEtiquetas(distancias);
      descartarEixos(eixosAmbiente);
      descartarEixos(eixosSelecao);
      renderer.dispose();
      container.removeChild(renderer.domElement);
      container.removeChild(labelRenderer.domElement);
      cenaRef.current = null;
    };
  }, []);

  // Sincroniza a cena com a árvore: só recria geometria quando a forma de uma peça muda
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    const objetos = objetosRef.current;
    const lista = Object.values(elementos);

    // 1. Contêineres, geometrias e posições
    for (const elemento of lista) {
      let objeto = objetos.get(elemento.chave);
      if (!objeto) {
        objeto = { container: new Group() };
        objeto.container.userData.chave = elemento.chave;
        objetos.set(elemento.chave, objeto);
      }

      const { forma, parede, piso } = elemento;
      // Vãos são filhos dela na árvore, não um campo da própria parede: se algum deles mudou
      // (posição/medida), a geometria precisa recortar de novo mesmo sem `parede` ter mudado
      const vaosDaParede = parede ? lista.filter((e) => e.pai === elemento.chave && e.abertura) : undefined;
      const vaosMudaram =
        vaosDaParede &&
        (!objeto.vaos ||
          objeto.vaos.length !== vaosDaParede.length ||
          objeto.vaos.some((v, i) => v !== vaosDaParede[i]));
      const comTexturas = (!!parede || !!piso) && Object.keys(elemento.texturas ?? {}).length > 0;
      // Medidas inválidas (ex.: campo sendo digitado) mantêm a última forma válida
      const furacao = elemento.categoria === 'furacao';
      if (forma && (forma !== objeto.forma || furacao !== !!objeto.furacao) && parametrosValidos(forma.tipo, forma.parametros)) {
        definirForma(objeto, elemento.chave, forma, furacao);
      } else if (
        parede &&
        (parede !== objeto.parede || vaosMudaram || comTexturas !== !!objeto.geometriaDividida) &&
        paredeValida(parede)
      ) {
        definirParede(objeto, elemento.chave, parede, vaosDaParede ?? [], comTexturas);
      } else if (
        piso &&
        (piso !== objeto.piso || comTexturas !== !!objeto.geometriaDividida) &&
        pisoValido(piso)
      ) {
        definirPiso(objeto, elemento.chave, piso, comTexturas);
      } else if (elemento.modelo3d && chaveModelo3d(elemento.modelo3d, elemento.modelo3dNo) !== objeto.modelo3dCarregando) {
        definirModelo3d(objeto, elemento.chave, elemento.modelo3d, elemento.modelo3dNo);
      }
      if (elemento.forma && objeto.forma) definirTexturas(objeto, facesDaForma(objeto.forma), elemento.texturas);
      else if ((parede && objeto.parede) || (piso && objeto.piso)) definirTexturas(objeto, FACES_TEXTURA.caixa, elemento.texturas);
      // Renderiza a posição real sempre que ela é um número de verdade (NaN/Infinity só acontece
      // com um campo sendo digitado) — não usa posicaoValida aqui: aquele limite é uma folga
      // pensada pra sanear entrada do usuário e da API, não um teto pro que a cena pode desenhar
      if (Object.values(elemento.posicao).every(Number.isFinite)) {
        // Vista Explodida: afasta o container do lugar salvo só pra visualização (não mexe em
        // elemento.posicao, então não marca o projeto como alterado nem entra no desfazer)
        const deslocamento = explodido
          ? deslocamentoExplosaoRecursivo(elementos, explodido.chave, elemento.chave, explodido.distancia)
          : null;
        const x = elemento.posicao.x + (deslocamento?.x ?? 0);
        const y = elemento.posicao.y + (deslocamento?.y ?? 0);
        const z = elemento.posicao.z + (deslocamento?.z ?? 0);
        // z dos dados (altura) -> Y nativo da cena; y dos dados (profundidade) -> Z nativo, espelhado
        objeto.container.position.set(x, z, SENTIDO_Z * y);
      }
      if (Object.values(elemento.rotacao).every(Number.isFinite)) {
        aplicarRotacao(objeto.container, elemento.rotacao);
      }
      // Peça de modelo 3D é redimensionável: a malha sempre carrega no tamanho original do
      // arquivo, então a escala aplicada é sempre a razão até o tamanho atual do elemento —
      // roda em toda sincronização (não só quando o modelo troca), pra pegar mudanças de tamanho
      if (elemento.modelo3d) {
        objeto.tamanhoAlvo = elemento.tamanho;
        objeto.texturasAlvo = elemento.texturas;
        ajustarModelo(objeto);
      }
    }

    // 2. Hierarquia: cada contêiner dentro do contêiner do pai
    for (const elemento of lista) {
      const { container } = objetos.get(elemento.chave) as ObjetoElemento;
      const pai = elemento.pai === null ? cena.raiz : (objetos.get(elemento.pai) as ObjetoElemento).container;
      if (container.parent !== pai) pai.add(container);
    }

    // 3. Remove o que saiu da árvore (filhos mantidos já foram para o novo pai no passo 2)
    for (const [chave, objeto] of objetos) {
      if (!elementos[chave]) {
        descartarObjeto(objeto);
        objetos.delete(chave);
      }
    }

    // Seleção completa (a primária mais as extras do Ctrl/Cmd+Click): todas recebem o mesmo
    // destaque forte, sem distinção — só a primária (selecionada) fica com o gizmo, mais abaixo
    const naSelecao = (chave: string) => chave === selecionada || selecaoExtra.includes(chave);

    // 4. Aparência: seleção destaca todo o conteúdo; fora do grupo aberto fica esmaecido
    for (const elemento of lista) {
      const foraDoContexto = contexto !== null && !estaDentro(elementos, elemento.chave, contexto);
      const objeto = objetos.get(elemento.chave) as ObjetoElemento;
      aplicarAparencia(objeto, naSelecao(elemento.chave), foraDoContexto);
      if (elemento.tipo === 'peca' || elemento.tipo === 'grupo') definirEtiqueta(objeto, elemento, foraDoContexto);
    }

    // Caixa tracejada dos grupos selecionados ou abertos para edição
    for (const elemento of lista) {
      if (elemento.tipo !== 'grupo') continue;
      atualizarCaixaGrupo(
        objetos.get(elemento.chave) as ObjetoElemento,
        elemento.tamanho,
        naSelecao(elemento.chave) || elemento.chave === contexto,
        COR_DESTAQUE_GRUPO,
        !naSelecao(elemento.chave),
      );
    }

    // Peça de modelo 3D: como a malha vem de um arquivo importado (com os próprios materiais e
    // texturas), a seleção não recolore ela como as demais peças — só a caixa tracejada aparece,
    // e só quando selecionada (ao contrário do grupo, que a mostra sempre que aberto também)
    for (const elemento of lista) {
      if (elemento.tipo !== 'peca' || !elemento.modelo3d) continue;
      atualizarCaixaGrupo(
        objetos.get(elemento.chave) as ObjetoElemento,
        elemento.tamanho,
        naSelecao(elemento.chave),
        COR_DESTAQUE_OBJETO,
        false,
      );
    }

    // Visibilidade: cada elemento segue visivel (um grupo oculto já esconde o conteúdo junto,
    // mesmo o que estiver com visivel:true, porque o three.js não desenha filho de container
    // invisível). Editando paredes, esconde por cima o grupo (ou a parede avulsa) sendo editado —
    // some junto tudo o que está dentro dele (malha, arestas e a caixa tracejada), já que a
    // pré-visualização cinza do construtor já mostra o resultado, e as paredes reais por baixo só
    // atrapalhariam
    for (const elemento of lista) {
      (objetos.get(elemento.chave) as ObjetoElemento).container.visible = elemento.visivel !== false;
    }
    if (ferramenta === 'parede' && chaveEdicaoParede) {
      const alvoEdicao = objetos.get(chaveEdicaoParede);
      if (alvoEdicao) alvoEdicao.container.visible = false;
    }

    // Foco num módulo: esconde tudo que não for ele, um ancestral (a hierarquia de containers
    // precisa deles visíveis pra transmitir a posição até o módulo focado) ou algo dentro dele.
    // O módulo focado e o que está dentro dele seguem elemento.visivel normalmente (já aplicado
    // acima); um ancestral fica visível mesmo se estivesse oculto, só pra não travar a exibição
    if (chaveEmFoco && elementos[chaveEmFoco]) {
      for (const elemento of lista) {
        const objeto = objetos.get(elemento.chave) as ObjetoElemento;
        const ancestralDoFoco = elemento.chave !== chaveEmFoco && estaDentro(elementos, chaveEmFoco, elemento.chave);
        if (ancestralDoFoco) {
          objeto.container.visible = true;
        } else if (!estaDentro(elementos, elemento.chave, chaveEmFoco)) {
          objeto.container.visible = false;
        }
      }
    }

    // Eixos: com seleção, os do elemento selecionado; sem seleção, os do grupo aberto
    // (espaço em que as posições são medidas) ou, na raiz, os do ambiente
    const chaveEixos = selecionada ?? contexto;
    const alvoEixos = chaveEixos ? objetos.get(chaveEixos) : undefined;
    cena.eixosAmbiente.visible = alvoEixos === undefined;
    cena.eixosSelecao.visible = alvoEixos !== undefined;
    cena.alvoEixos = alvoEixos?.container ?? null;
    if (alvoEixos) {
      const tamanho = new Box3().setFromObject(alvoEixos.container).getSize(new Vector3());
      cena.eixosSelecao.scale.setScalar(
        Math.max(Math.max(tamanho.x, tamanho.y, tamanho.z) * 0.75, COMPRIMENTO_MINIMO_EIXOS),
      );
    }

    // Setas para mover, anéis para girar; o construtor de paredes não usa o gizmo 3D
    const gizmoAtivo = ferramenta === 'mover' || ferramenta === 'girar';
    const alvo = gizmoAtivo && selecionada ? objetos.get(selecionada) : undefined;
    cena.transform.setMode(ferramenta === 'girar' ? 'rotate' : 'translate');
    if (!alvo) cena.transform.detach();
    else if (cena.transform.object !== alvo.container) cena.transform.attach(alvo.container);

    // Piso e caixa tracejada da planta do ambiente (etapa "Planta do ambiente" do assistente)
    atualizarSala(cena.sala, planta);

    // No primeiro quadro com algo a mostrar, enquadra a raiz e, se houver, a planta do ambiente
    // (um projeto novo, sem peças, ainda mostra a planta vazia)
    if (!enquadradoRef.current && enquadrar(cena, cena.raiz, planta ? cena.sala.grupo : undefined)) {
      enquadradoRef.current = true;
    }
  }, [elementos, planta, selecionada, selecaoExtra, contexto, ferramenta, chaveEdicaoParede, explodido, chaveEmFoco]);

  const alturaParedes = alturaEdicaoParede ?? planta?.z ?? PE_DIREITO_PADRAO;
  const alinhamentoParede: AlinhamentoParede = chaveEdicaoParede ? 'central' : alinhamentoSelecionado;

  // Construtor de paredes: clique no piso da cena 3D (câmera livre para orbitar entre os
  // cliques, como no resto do editor) marca um canto; Enter conclui, clique perto do primeiro
  // ponto fecha o contorno, Backspace desfaz o último ponto e Esc cancela. Clicar em cima de uma
  // parede já existente (não a que estiver sendo reeditada) engata a ponta ali — uma parede
  // interna de verdade, encostada em T na parede de fora, em vez de flutuando solta
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || ferramenta !== 'parede') return;

    const raycaster = new Raycaster();
    const plano = new Plane(new Vector3(0, 1, 0), 0);
    const dom = cena.renderer.domElement;
    const camera = cena.camera;

    interface PontoClicado {
      ponto: Posicao;
      engate: EngateParede | null;
    }

    // Malhas de parede clicáveis pra engatar: qualquer parede visível, menos a que estiver sendo
    // reeditada agora (ela já fica invisível na cena enquanto editada, mas confere aqui também)
    function paredesParaEngate(): Mesh[] {
      return malhasVisiveis(objetosRef.current).filter((malha) => {
        const chave = malha.userData.chave as string | undefined;
        if (!chave || !elementosRef.current[chave]?.parede) return false;
        return !(chaveEdicaoParede !== null && estaDentro(elementosRef.current, chave, chaveEdicaoParede));
      });
    }

    // Projeta o ponto clicado no centro da parede atingida (a mesma linha que os cantos dela já
    // seguem), preso entre as duas pontas dela — vira o canto novo, junto da espessura dela pra
    // saber o quanto recuar depois (ver aplicarEngatesNasPontas)
    function engateNaParede(acerto: Intersection): PontoClicado | null {
      const chave = acerto.object.userData.chave as string | undefined;
      const elemento = chave ? elementosRef.current[chave] : undefined;
      const objeto = chave ? objetosRef.current.get(chave) : undefined;
      if (!elemento?.parede || !objeto) return null;
      const local = objeto.container.worldToLocal(acerto.point.clone());
      const x = Math.min(Math.max(local.x, 0), elemento.parede.comprimento);
      const mundo = objeto.container.localToWorld(new Vector3(x, 0, 0));
      return {
        ponto: { x: limitarPosicao(mundo.x), y: limitarPosicao(SENTIDO_Z * mundo.z), z: 0 },
        engate: { espessura: elemento.parede.espessura },
      };
    }

    function pontoNoChao(e: { clientX: number; clientY: number }): PontoClicado | null {
      raycaster.setFromCamera(ponteiroNormalizado(e, dom), camera);
      const [acertoParede] = raycaster.intersectObjects(paredesParaEngate(), false);
      const engate = acertoParede && engateNaParede(acertoParede);
      if (engate) return engate;

      const alvo = new Vector3();
      if (!raycaster.ray.intersectPlane(plano, alvo)) return null;
      return { ponto: { x: limitarPosicao(alvo.x), y: limitarPosicao(SENTIDO_Z * alvo.z), z: 0 }, engate: null };
    }

    function fechariaContorno(ponto: Posicao) {
      return pontosParede.length > 1 && distanciaXY(ponto, pontosParede[0]) <= LIMIAR_FECHAR_CONTORNO;
    }

    const inicioClique = new Vector2();
    const aoPressionar = (e: PointerEvent) => {
      inicioClique.set(e.clientX, e.clientY);
      const clicado = pontoNoChao(e);
      const indice = clicado ? indiceVerticeProximo(pontosParede, clicado.ponto) : null;
      arrastandoIndiceRef.current = indice;
      // Enquanto arrasta um vértice, a câmera não gira (como no arraste das setas de mover)
      if (indice !== null) cena.controls.enabled = false;
    };
    const aoSoltar = (e: PointerEvent) => {
      const indiceArrastado = arrastandoIndiceRef.current;
      arrastandoIndiceRef.current = null;
      const arrastou = inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE;

      if (indiceArrastado !== null && arrastou) {
        // Arraste de verdade: aplica a nova posição, já travada reta (ou funde, se soltou perto
        // de um vizinho) — a mesma trava que a pré-visualização já mostrava durante o arraste
        cena.controls.enabled = true;
        setVerticeArrastado(null);
        const clicado = pontoNoChao(e);
        if (clicado) {
          const posicaoTravada = clicado.engate
            ? clicado.ponto
            : travarVerticeArrastado(pontosParede, indiceArrastado, clicado.ponto, fechadoInicial);
          setPontosParede((atual) => moverOuFundirVertice(atual, indiceArrastado, posicaoTravada, fechadoInicial));
          if (indiceArrastado === 0) setEngateInicio(clicado.engate);
          if (indiceArrastado === pontosParede.length - 1) setEngateFim(clicado.engate);
        }
        return;
      }
      if (indiceArrastado !== null) {
        // Só um clique num vértice, sem mover: reabilita a câmera e cai no tratamento de clique
        // comum abaixo — fechar o contorno tem prioridade sobre "clicou num vértice: nada a fazer"
        cena.controls.enabled = true;
        setVerticeArrastado(null);
      }

      if (arrastou) return; // foi um arraste da câmera (OrbitControls), ignora
      const clicado = pontoNoChao(e);
      if (!clicado) return;
      const { ponto, engate } = clicado;
      if (fechariaContorno(ponto)) {
        concluirDesenhoParede(true);
        return;
      }
      if (indiceVerticeProximo(pontosParede, ponto) !== null) return; // clicou num vértice: nada a fazer

      const indiceSegmento = indiceSegmentoProximo(pontosParede, ponto);
      if (indiceSegmento !== null) {
        // Clicou em cima de uma parede existente: insere um canto novo ali, dividindo-a em duas
        setPontosParede((atual) => [...atual.slice(0, indiceSegmento + 1), ponto, ...atual.slice(indiceSegmento + 1)]);
        return;
      }
      // Marcando um canto novo no fim: trava reto se estiver perto de um ângulo reto, do mesmo
      // jeito que a pré-visualização já mostrava — a não ser que tenha engatado numa parede, que
      // já dá a direção certa sozinho
      const ultimoConfirmado = pontosParede.at(-1);
      const pontoConfirmado = !engate && ultimoConfirmado ? travarNaLinhaReta(ultimoConfirmado, ponto) : ponto;
      if (pontosParede.length === 0) setEngateInicio(engate);
      setEngateFim(engate);
      setPontosParede((atual) => [...atual, pontoConfirmado]);
    };
    const aoMoverMouse = (e: PointerEvent) => {
      const clicado = pontoNoChao(e);
      const ultimoConfirmado = pontosParede.at(-1);
      const pontoPreview = clicado && (clicado.engate || !ultimoConfirmado)
        ? clicado.ponto
        : clicado && ultimoConfirmado
          ? travarNaLinhaReta(ultimoConfirmado, clicado.ponto)
          : null;
      setMouseNoChao(pontoPreview);

      const indiceArrastado = arrastandoIndiceRef.current;
      if (indiceArrastado !== null && clicado) {
        setVerticeArrastado({
          indice: indiceArrastado,
          posicao: clicado.engate
            ? clicado.ponto
            : travarVerticeArrastado(pontosParede, indiceArrastado, clicado.ponto, fechadoInicial),
        });
      }
    };
    const aoSairDaArea = () => setMouseNoChao(null);

    // Atalhos da ferramenta Parede — se mudar algum, atualize a página de ajuda (pages/public/Ajuda/conteudo.ts)
    function aoTeclar(e: KeyboardEvent) {
      // Ctrl funciona mesmo com o campo de distância já focado (pra reselecionar o texto antes do
      // próximo número) — só não faz nada se o foco estiver em OUTRO campo (ex.: Espessura), pra
      // não roubar dele. Os demais atalhos abaixo continuam bloqueados por um campo focado
      if (e.key === 'Control') {
        if (e.repeat) return;
        const campo = distanciaParedeInputRef.current;
        const foco = document.activeElement;
        if (!campo || (foco instanceof HTMLInputElement && foco !== campo)) return;
        e.preventDefault();
        digitouNaExtensaoRef.current = false;
        campo.focus();
        campo.select();
        return;
      }
      const foco = document.activeElement;
      if (foco !== null && foco === distanciaParedeInputRef.current) {
        // Digitando no campo de extensão: as teclas são dele. Só Enter/Esc sem nada digitado (ou o
        // Enter/Esc logo depois de confirmar) passam adiante como atalhos da ferramenta
        if (e.key !== 'Enter' && e.key !== 'Escape') {
          digitouNaExtensaoRef.current = true;
          return;
        }
        if (digitouNaExtensaoRef.current) {
          digitouNaExtensaoRef.current = false;
          return;
        }
      } else if (foco instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        callbacksRef.current.onCancelarParede();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        concluirDesenhoParede(deveFecharContorno());
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        desfazerUltimoPontoParede();
      }
    }

    dom.addEventListener('pointerdown', aoPressionar);
    dom.addEventListener('pointerup', aoSoltar);
    dom.addEventListener('pointermove', aoMoverMouse);
    dom.addEventListener('pointerleave', aoSairDaArea);
    window.addEventListener('keydown', aoTeclar);
    return () => {
      dom.removeEventListener('pointerdown', aoPressionar);
      dom.removeEventListener('pointerup', aoSoltar);
      dom.removeEventListener('pointermove', aoMoverMouse);
      dom.removeEventListener('pointerleave', aoSairDaArea);
      window.removeEventListener('keydown', aoTeclar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ferramenta, pontosParede, alturaParedes, espessuraParede, fechadoInicial, chaveEdicaoParede]);

  // Trena: clique marca um ponto de medição — no que estiver sob o cursor (peça, parede, piso ou
  // modelo 3D); sem nada ali, no piso da cena (y=0). Cada ponto depois do primeiro fecha um
  // segmento com a distância dele mostrada em cima; Esc limpa tudo, Backspace desfaz o último
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || ferramenta !== 'trena') return;

    const raycaster = new Raycaster();
    const plano = new Plane(new Vector3(0, 1, 0), 0);
    const dom = cena.renderer.domElement;
    const camera = cena.camera;

    function pontoDeMedicao(e: { clientX: number; clientY: number }): Posicao | null {
      // Vértice de alguma peça/grupo/parede perto do ponteiro na tela tem prioridade — mesmo
      // comportamento de qualquer ferramenta de CAD, pra medir de canto a canto sem depender de
      // acertar o pixel exato (bem mais difícil ainda no toque do celular)
      const ima = verticeMaisProximo(verticesVisiveis(elementosRef.current, objetosRef.current), e, camera, dom);
      if (ima) {
        return { x: limitarPosicao(ima.x), y: limitarPosicao(SENTIDO_Z * ima.z), z: limitarPosicao(ima.y) };
      }

      raycaster.setFromCamera(ponteiroNormalizado(e, dom), camera);
      const [acerto] = raycaster.intersectObjects(malhasVisiveis(objetosRef.current), false);
      if (acerto) {
        // acerto.point é um ponto de verdade em 3D (não só no piso): Y nativo (altura) -> z dos
        // dados, Z nativo (profundidade) -> y dos dados
        return { x: limitarPosicao(acerto.point.x), y: limitarPosicao(SENTIDO_Z * acerto.point.z), z: acerto.point.y };
      }
      const alvo = new Vector3();
      if (!raycaster.ray.intersectPlane(plano, alvo)) return null;
      return { x: limitarPosicao(alvo.x), y: limitarPosicao(SENTIDO_Z * alvo.z), z: 0 };
    }

    const inicioClique = new Vector2();
    const aoPressionar = (e: PointerEvent) => inicioClique.set(e.clientX, e.clientY);
    const aoSoltar = (e: PointerEvent) => {
      if (inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE) return; // foi orbitar
      const ponto = pontoDeMedicao(e);
      if (ponto) setPontosTrena((atual) => [...atual, ponto]);
    };
    const aoMoverMouse = (e: PointerEvent) => setMouseTrena(pontoDeMedicao(e));
    const aoSairDaArea = () => setMouseTrena(null);

    // Atalhos da ferramenta Trena — se mudar algum, atualize a página de ajuda (pages/public/Ajuda/conteudo.ts)
    function aoTeclar(e: KeyboardEvent) {
      if (document.activeElement instanceof HTMLInputElement) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        setPontosTrena([]);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        setPontosTrena((atual) => atual.slice(0, -1));
      }
    }

    dom.addEventListener('pointerdown', aoPressionar);
    dom.addEventListener('pointerup', aoSoltar);
    dom.addEventListener('pointermove', aoMoverMouse);
    dom.addEventListener('pointerleave', aoSairDaArea);
    window.addEventListener('keydown', aoTeclar);
    return () => {
      dom.removeEventListener('pointerdown', aoPressionar);
      dom.removeEventListener('pointerup', aoSoltar);
      dom.removeEventListener('pointermove', aoMoverMouse);
      dom.removeEventListener('pointerleave', aoSairDaArea);
      window.removeEventListener('keydown', aoTeclar);
    };
  }, [ferramenta]);

  // Balde de tinta: clique numa face pintável (peça, parede ou piso) aplica a tinta carregada
  // (cor sólida ou imagem importada/reaproveitada) só naquela face — a mesma infraestrutura de
  // texturas por face de sempre; cor sólida vai direto (ver Formas.EhCorSolida na API)
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena || ferramenta !== 'pintura') return;
    // "Remover" manda null de propósito (tira a textura da face); no modo Imagem, sem nada
    // carregado ainda, não tem o que aplicar
    const imagem = modoTinta === 'cor' ? corTinta : modoTinta === 'imagem' ? imagemTinta : null;
    if (modoTinta === 'imagem' && !imagem) return;

    const raycaster = new Raycaster();
    const dom = cena.renderer.domElement;
    const camera = cena.camera;

    const inicioClique = new Vector2();
    const aoPressionar = (e: PointerEvent) => inicioClique.set(e.clientX, e.clientY);
    const aoSoltar = (e: PointerEvent) => {
      if (inicioClique.distanceTo(new Vector2(e.clientX, e.clientY)) > TOLERANCIA_CLIQUE) return; // foi orbitar
      raycaster.setFromCamera(ponteiroNormalizado(e, dom), camera);
      const [acerto] = raycaster.intersectObjects(malhasVisiveis(objetosRef.current), false);
      if (!acerto?.face) return;
      const chave = acerto.object.userData.chave as string | undefined;
      const elemento = chave ? elementosRef.current[chave] : undefined;
      if (!elemento || !(elemento.forma || elemento.modelo3d || elemento.parede || elemento.piso)) return;
      callbacksRef.current.onPintarFace(chave as string, faceClicada(elemento, acerto.face.normal), imagem);
    };

    dom.addEventListener('pointerdown', aoPressionar);
    dom.addEventListener('pointerup', aoSoltar);
    return () => {
      dom.removeEventListener('pointerdown', aoPressionar);
      dom.removeEventListener('pointerup', aoSoltar);
    };
  }, [ferramenta, modoTinta, corTinta, imagemTinta]);

  // Remove o último canto marcado — mesma ação do Backspace, só que também acessível por um
  // botão (ver .acoesParede): sem teclado físico (celular), Backspace nunca dispara
  function desfazerUltimoPontoParede() {
    setEngateFim(null);
    setPontosParede((atual) => atual.slice(0, -1));
  }

  // Transforma os pontos marcados em segmentos de parede e entrega ao editor; `fecharContorno`
  // acrescenta um segmento de volta ao primeiro ponto antes de calcular
  function concluirDesenhoParede(fecharContorno: boolean) {
    if (pontosParede.length < 2) {
      callbacksRef.current.onCancelarParede();
      return;
    }
    callbacksRef.current.onConcluirParedes(
      pontosDoEixoDaParede(pontosParede, fecharContorno, espessuraParede, alinhamentoParede),
      fecharContorno,
      { altura: alturaParedes, espessura: espessuraParede },
      chaveEdicaoParede,
      fecharContorno ? undefined : (engateInicio ?? undefined),
      fecharContorno ? undefined : (engateFim ?? undefined),
    );
  }

  // Concluir (Enter ou o botão) só fechava o contorno se ele já tivesse começado fechado
  // (reedição) — um desenho novo cujo último canto ficou perto do início (sem o usuário ter
  // clicado bem em cima do marcador pra disparar o fechamento automático) terminava aberto por
  // engano: faltava a parede de fechamento e o piso nunca era criado
  function deveFecharContorno() {
    return (
      fechadoInicial ||
      (pontosParede.length > 1 && distanciaXY(pontosParede.at(-1)!, pontosParede[0]) <= LIMIAR_FECHAR_CONTORNO)
    );
  }

  // Muda a extensão da última parede marcada (do penúltimo ao último canto): o último canto anda
  // ao longo da mesma direção até a extensão digitada. A extensão só se digita depois do segundo
  // canto — o segundo é marcado por clique, que define a direção; daí em diante o número manda.
  // Mexer no último canto desfaz o engate dele numa parede existente (ele não está mais lá)
  function estenderUltimaParede(extensaoMm: number): boolean {
    if (pontosParede.length < 2) return false;
    const ultimo = pontosParede[pontosParede.length - 1];
    const penultimo = pontosParede[pontosParede.length - 2];
    const dx = ultimo.x - penultimo.x;
    const dy = ultimo.y - penultimo.y;
    const comprimento = Math.hypot(dx, dy);
    if (comprimento < 1e-6) return false;

    const novo: Posicao = {
      x: limitarPosicao(penultimo.x + (dx / comprimento) * extensaoMm),
      y: limitarPosicao(penultimo.y + (dy / comprimento) * extensaoMm),
      z: 0,
    };
    setEngateFim(null);
    setPontosParede((atual) => [...atual.slice(0, -1), novo]);
    return true;
  }

  // Redesenha a pré-visualização (blocos confirmados, marcadores e o segmento elástico até o
  // mouse) sempre que os pontos, o mouse no piso ou as medidas atuais mudam
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    const { grupo, segmentos, materialSegmento, marcadores, elastico, marcadorFechar } = cena.parede;

    grupo.visible = ferramenta === 'parede';
    if (ferramenta !== 'parede') return;

    // Enquanto arrasta um vértice, a pré-visualização usa a posição provisória dele; o elástico
    // até o mouse e a detecção de fechamento não fazem sentido nesse momento (ver abaixo)
    const arrastando = verticeArrastado !== null;
    const pontosExibidos = verticeArrastado
      ? pontosParede.map((p, i) => (i === verticeArrastado.indice ? verticeArrastado.posicao : p))
      : pontosParede;

    limparGeometrias(segmentos);
    // Reflete o contorno como ele já estava (fechado ou não) — reeditar um contorno fechado
    // mostra a parede de fechamento também, não só as pontas soltas de um desenho novo. Os
    // engates nas pontas (ver aplicarEngatesNasPontas) já entram aqui, pra pré-visualização bater
    // com o resultado final — sem isso, pareceria que a parede interna atravessa a de fora
    const pontosDoEixo = pontosDoEixoDaParede(pontosExibidos, fechadoInicial, espessuraParede, alinhamentoParede);
    const segmentosPreview = fechadoInicial
      ? construirSegmentosParede(pontosDoEixo, true, espessuraParede)
      : aplicarEngatesNasPontas(
          construirSegmentosParede(pontosDoEixo, false, espessuraParede),
          engateInicio ?? undefined,
          engateFim ?? undefined,
        );
    for (const segmento of segmentosPreview) {
      const bloco = new Mesh(
        criarGeometriaParede({ comprimento: segmento.comprimento, altura: alturaParedes, espessura: espessuraParede }, []),
        materialSegmento,
      );
      bloco.position.set(segmento.posicao.x, 0, SENTIDO_Z * segmento.posicao.y);
      bloco.rotation.y = MathUtils.degToRad(segmento.rotacaoZ);
      segmentos.add(bloco);
    }

    limparMalhasProprias(marcadores);
    for (const [indice, ponto] of pontosExibidos.entries()) {
      const destacado = verticeArrastado?.indice === indice;
      const esfera = new Mesh(
        new SphereGeometry(indice === 0 ? 70 : destacado ? 60 : 45, 16, 12),
        new MeshBasicMaterial({ color: destacado ? 0xffffff : COR_SELECIONADA }),
      );
      esfera.position.set(ponto.x, 0, SENTIDO_Z * ponto.y);
      marcadores.add(esfera);
    }

    // A "parede fantasma" até o mouse (e o destaque de fechar o contorno) só fazem sentido
    // desenhando do zero: reeditando um contorno existente, ela só atrapalharia a visão dele
    const mostrarPreviaAoMouse = !arrastando && !chaveEdicaoParede;
    const ultimoPonto = pontosExibidos.at(-1);
    const fechando =
      mostrarPreviaAoMouse &&
      mouseNoChao !== null &&
      pontosExibidos.length > 1 &&
      distanciaXY(mouseNoChao, pontosExibidos[0]) <= LIMIAR_FECHAR_CONTORNO;
    const comprimentoElastico =
      mostrarPreviaAoMouse && ultimoPonto && mouseNoChao ? distanciaXY(ultimoPonto, mouseNoChao) : 0;

    if (mostrarPreviaAoMouse && ultimoPonto && mouseNoChao && comprimentoElastico >= MEDIDA_MINIMA && !fechando) {
      elastico.geometry.dispose();
      elastico.geometry = criarGeometriaParede(
        { comprimento: comprimentoElastico, altura: alturaParedes, espessura: espessuraParede },
        [],
      );
      const origemElastico = deslocarTrechoParaOEixo(
        ultimoPonto,
        mouseNoChao,
        pontosExibidos,
        espessuraParede,
        alinhamentoParede,
      );
      elastico.position.set(origemElastico.x, 0, SENTIDO_Z * origemElastico.y);
      elastico.rotation.y = MathUtils.degToRad(anguloGraus(ultimoPonto, mouseNoChao));
      elastico.visible = true;
    } else {
      elastico.visible = false;
    }

    marcadorFechar.visible = fechando;
    if (fechando) marcadorFechar.position.set(pontosExibidos[0].x, 0, SENTIDO_Z * pontosExibidos[0].y);
  }, [
    pontosParede,
    mouseNoChao,
    verticeArrastado,
    fechadoInicial,
    alturaParedes,
    espessuraParede,
    alinhamentoParede,
    ferramenta,
    chaveEdicaoParede,
    engateInicio,
    engateFim,
  ]);

  // Redesenha a trena: a linha entre os pontos confirmados, um marcador em cada um, o segmento
  // elástico até o mouse e uma etiqueta de distância por segmento (inclusive a do elástico)
  useEffect(() => {
    const cena = cenaRef.current;
    if (!cena) return;
    const { grupo, linha, elastico, marcadores, etiquetas } = cena.trena;

    grupo.visible = ferramenta === 'trena';
    if (ferramenta !== 'trena') return;

    // z dos dados (altura) -> Y nativo da cena; y dos dados (profundidade) -> Z nativo, espelhado
    const posicaoCena = (p: Posicao) => new Vector3(p.x, p.z, SENTIDO_Z * p.y);
    const etiquetar = (a: Posicao, b: Posicao) => {
      const meio = posicaoCena({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
      const html = document.createElement('div');
      html.className = styles.etiquetaTrena;
      html.textContent = `${formatarCm(distancia3D(a, b))} cm`;
      const etiqueta = new CSS2DObject(html);
      etiqueta.position.copy(meio);
      etiquetas.add(etiqueta);
    };

    linha.geometry.dispose();
    linha.geometry = new BufferGeometry().setFromPoints(pontosTrena.map(posicaoCena));

    limparMalhasProprias(marcadores);
    for (const ponto of pontosTrena) {
      const esfera = new Mesh(new SphereGeometry(RAIO_MARCADOR_TRENA, 12, 8), new MeshBasicMaterial({ color: COR_TRENA }));
      esfera.position.copy(posicaoCena(ponto));
      marcadores.add(esfera);
    }

    limparEtiquetas(etiquetas);
    for (let i = 1; i < pontosTrena.length; i++) etiquetar(pontosTrena[i - 1], pontosTrena[i]);

    const ultimoPonto = pontosTrena.at(-1);
    if (ultimoPonto && mouseTrena && distancia3D(ultimoPonto, mouseTrena) >= MEDIDA_MINIMA) {
      elastico.geometry.dispose();
      elastico.geometry = new BufferGeometry().setFromPoints([posicaoCena(ultimoPonto), posicaoCena(mouseTrena)]);
      elastico.visible = true;
      etiquetar(ultimoPonto, mouseTrena);
    } else {
      elastico.visible = false;
    }
  }, [pontosTrena, mouseTrena, ferramenta]);

  async function importarImagemTinta(arquivo: File) {
    setCarregandoImagemTinta(true);
    setErroTinta(null);
    try {
      setImagemTinta(await lerTexturaJpeg(arquivo));
      setNomeImagemTinta(arquivo.name);
    } catch (e) {
      setErroTinta(e instanceof Error ? e.message : 'Não foi possível importar a imagem.');
    } finally {
      setCarregandoImagemTinta(false);
    }
  }

  function enquadrarAtual(vista: VistaId = vistaDoEnquadramento) {
    const cena = cenaRef.current;
    if (!cena) return;
    // Com algo selecionado (um elemento ou vários), enquadra a seleção
    const selecionados = (selecionada ? [selecionada, ...selecaoExtra] : [])
      .map((chave) => objetosRef.current.get(chave)?.container)
      .filter((container): container is Group => !!container);
    if (selecionados.length > 0 && enquadrar(cena, selecionados, undefined, vista)) return;

    // Sem seleção: com um grupo aberto, enquadra só o grupo; na raiz, a árvore inteira e a planta do ambiente
    const grupo = contexto ? objetosRef.current.get(contexto)?.container : undefined;
    if (!grupo || !enquadrar(cena, grupo, undefined, vista)) {
      enquadrar(cena, cena.raiz, planta ? cena.sala.grupo : undefined, vista);
    }
  }

  // Clicar de novo na peça/grupo já focado (ou sem nada selecionado) sai do foco; com uma seleção
  // diferente, troca o foco pra ela — sempre reenquadrando o módulo focado
  function alternarFoco() {
    if (chaveEmFoco && (!selecionada || selecionada === chaveEmFoco)) {
      setChaveEmFoco(null);
      return;
    }
    if (!selecionada) return;
    setChaveEmFoco(selecionada);
    const cena = cenaRef.current;
    const alvo = objetosRef.current.get(selecionada);
    if (cena && alvo) enquadrar(cena, alvo.container);
  }

  const dicaFerramenta =
    ferramenta === 'selecionar'
      ? 'Clique para selecionar · Ctrl+clique seleciona vários · duplo clique edita o conteúdo · arraste para orbitar'
      : !selecionada
        ? `Clique em um elemento para ${ferramenta === 'mover' ? 'mover' : 'girar'}`
        : ferramenta === 'mover'
          ? 'Arraste as setas para mover em X, Y e Z'
          : `Arraste os anéis para girar em X, Y e Z (passos de ${PASSO_ROTACAO}°)`;
  const dica = contexto ? `${dicaFerramenta} · Esc sai` : dicaFerramenta;

  const ultimoPontoTrena = pontosTrena.at(-1);
  const distanciaSegmentoTrena = ultimoPontoTrena && mouseTrena ? distancia3D(ultimoPontoTrena, mouseTrena) : null;
  const distanciaTotalTrena =
    pontosTrena.slice(1).reduce((soma, ponto, i) => soma + distancia3D(pontosTrena[i], ponto), 0) +
    (distanciaSegmentoTrena ?? 0);

  const ultimoPontoParede = chaveEdicaoParede ? undefined : pontosParede.at(-1);
  // Distância do último canto até o mouse (só informativa: antes do segundo canto o clique define tudo)
  const distanciaAtual = ultimoPontoParede && mouseNoChao ? distanciaXY(ultimoPontoParede, mouseNoChao) : null;
  // Extensão da última parede já marcada, a que o campo digitável edita (existe a partir do 2º canto)
  const extensaoUltimaParede =
    !chaveEdicaoParede && pontosParede.length >= 2
      ? distanciaXY(pontosParede[pontosParede.length - 2], pontosParede[pontosParede.length - 1])
      : null;
  // A cada canto novo (do segundo em diante), o foco vai pro campo de extensão, pra digitar o
  // comprimento direto (Ctrl faz o mesmo depois). Um instante de espera: o clique que marcou o canto
  // ainda termina de tratar o foco (mousedown) e tiraria o foco do campo recém-focado. Remover um
  // canto (Backspace) não puxa o foco
  const totalCantosParede = chaveEdicaoParede ? 0 : pontosParede.length;
  const totalCantosAnteriorRef = useRef(0);
  useEffect(() => {
    const anterior = totalCantosAnteriorRef.current;
    totalCantosAnteriorRef.current = totalCantosParede;
    if (ferramenta !== 'parede' || totalCantosParede < 2 || totalCantosParede <= anterior) return;
    const espera = window.setTimeout(() => {
      const campo = distanciaParedeInputRef.current;
      if (!campo) return;
      digitouNaExtensaoRef.current = false;
      campo.focus();
      campo.select();
    }, 60);
    return () => window.clearTimeout(espera);
  }, [ferramenta, totalCantosParede]);

  const fechandoContorno =
    !chaveEdicaoParede &&
    mouseNoChao !== null &&
    pontosParede.length > 1 &&
    distanciaXY(mouseNoChao, pontosParede[0]) <= LIMIAR_FECHAR_CONTORNO;

  return (
    <div className={styles.viewport}>
      <div ref={containerRef} className={styles.canvas} />
      <div className={styles.acoes}>
        <div ref={vistasRef} className={styles.vistas}>
          <button
            type="button"
            className={styles.botao}
            title={`Enquadrar na vista ${VISTAS[vistaDoEnquadramento].rotulo.toLowerCase()}`}
            onClick={() => enquadrarAtual()}
          >
            Enquadrar
            {vistaDoEnquadramento !== 'isometrica' ? ` · ${VISTAS[vistaDoEnquadramento].rotulo}` : ''}
          </button>
          <button
            type="button"
            className={styles.botao}
            aria-haspopup="menu"
            aria-expanded={menuDeVistasAberto}
            aria-label="Escolher a vista do enquadramento"
            title="Escolher a vista: topo, base, frente, fundo, esquerda, direita"
            onClick={alternarMenuDeVistas}
          >
            ▾
          </button>
          {menuDeVistasAberto &&
            posicaoMenuVistas &&
            createPortal(
              <div
                ref={menuVistasRef}
                className={styles.menuVistas}
                role="menu"
                aria-label="Vista do enquadramento"
                style={{ right: posicaoMenuVistas.direita, bottom: posicaoMenuVistas.baixo }}
              >
                {ORDEM_DAS_VISTAS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={vistaDoEnquadramento === id}
                    className={styles.itemVista}
                    onClick={() => {
                      setVistaDoEnquadramento(id);
                      setMenuDeVistasAberto(false);
                      enquadrarAtual(id);
                    }}
                  >
                    {VISTAS[id].rotulo}
                  </button>
                ))}
              </div>,
              document.body,
            )}
        </div>
        <button
          type="button"
          className={styles.botao}
          aria-pressed={chaveEmFoco !== null}
          disabled={!selecionada && !chaveEmFoco}
          title={chaveEmFoco ? 'Mostrar o restante do projeto' : 'Esconder tudo, menos o módulo selecionado'}
          onClick={alternarFoco}
        >
          {chaveEmFoco && (!selecionada || selecionada === chaveEmFoco) ? 'Sair do foco' : 'Focar módulo'}
        </button>
      </div>
      {ferramenta === 'parede' ? (
        <div className={styles.barraParede}>
          <p className={`${styles.dicaParede} ${styles.dicaConstrutorParede}`}>
            {chaveEdicaoParede
              ? 'Arraste um canto para movê-lo · clique numa parede insere um canto ali · arraste um canto até o vizinho remove · clique perto do início fecha'
              : 'Clique no piso para marcar os cantos · depois do segundo, digite a extensão da última parede · clique perto do início fecha o contorno'}
          </p>
          <div className={styles.linhaParede}>
            <div className={styles.campoEspessura}>
              <CampoMedida
                rotulo="Espessura"
                valor={espessuraParede}
                min={MEDIDA_MINIMA}
                max={MEDIDA_MAXIMA}
                onConfirmar={setEspessuraParede}
              />
            </div>
            {!chaveEdicaoParede && (
              <label className={styles.campoAlinhamento}>
                <span>Posição de construção</span>
                <select
                  value={alinhamentoSelecionado}
                  onChange={(e) => setAlinhamentoSelecionado(e.target.value as AlinhamentoParede)}
                  title="Centro: espessura dividida nos dois lados. Direita: espessura jogada para a parte externa do contorno. Esquerda: espessura tirada da parte interna, mantendo a externa"
                >
                  <option value="central">Centro</option>
                  <option value="direita">Direita</option>
                  <option value="esquerda">Esquerda</option>
                </select>
              </label>
            )}
            <span className={styles.infoParede}>Altura: {formatarCm(alturaParedes)} cm</span>
            {distanciaAtual !== null && fechandoContorno && (
              <span className={styles.infoParede}>Fechar contorno</span>
            )}
            {!chaveEdicaoParede && pontosParede.length === 1 && (
              <span className={styles.infoParede}>
                Marque o segundo ponto: depois dele a extensão passa a ser digitada
                {distanciaAtual !== null ? ` (agora: ${formatarCm(distanciaAtual)} cm)` : ''}
              </span>
            )}
            {extensaoUltimaParede !== null && (
              <div className={styles.campoDistanciaParede}>
                <CampoMedida
                  ref={distanciaParedeInputRef}
                  rotulo="Extensão"
                  valor={extensaoUltimaParede}
                  min={MEDIDA_MINIMA}
                  max={PAREDE_COMPRIMENTO_MAXIMO}
                  mensagemRecusa="Não foi possível mudar a extensão desta parede"
                  onConfirmar={(valor) => estenderUltimaParede(valor)}
                />
              </div>
            )}
            {extensaoUltimaParede !== null && distanciaAtual !== null && !fechandoContorno && (
              <span className={styles.infoParede}>Próxima: {formatarCm(distanciaAtual)} cm</span>
            )}
            <div className={styles.acoesParede}>
              <button type="button" className={styles.botaoSecundario} title="Cancelar (Esc)" onClick={onCancelarParede}>
                Cancelar
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                title="Desfazer o último canto (Backspace)"
                disabled={pontosParede.length === 0}
                onClick={desfazerUltimoPontoParede}
              >
                Desfazer
              </button>
              <button
                type="button"
                className={styles.botaoPrimario}
                title="Concluir (Enter)"
                disabled={pontosParede.length < 2}
                onClick={() => concluirDesenhoParede(deveFecharContorno())}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      ) : ferramenta === 'trena' ? (
        <div className={styles.barraParede}>
          <p className={styles.dicaParede}>Clique para marcar pontos de medição</p>
          <div className={styles.linhaParede}>
            {distanciaSegmentoTrena !== null && (
              <span className={styles.infoParede}>Segmento: {formatarCm(distanciaSegmentoTrena)} cm</span>
            )}
            {pontosTrena.length > 1 && (
              <span className={styles.infoParede}>Total: {formatarCm(distanciaTotalTrena)} cm</span>
            )}
            <div className={styles.acoesParede}>
              <button
                type="button"
                className={styles.botaoSecundario}
                title="Desfazer o último ponto (Backspace)"
                disabled={pontosTrena.length === 0}
                onClick={() => setPontosTrena((atual) => atual.slice(0, -1))}
              >
                Desfazer
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                title="Limpar tudo (Esc)"
                disabled={pontosTrena.length === 0}
                onClick={() => setPontosTrena([])}
              >
                Limpar
              </button>
            </div>
          </div>
        </div>
      ) : ferramenta === 'pintura' ? (
        <div className={styles.painelPintura}>
          <div className={styles.painelPinturaCabecalho}>
            <strong>Pintura</strong>
            <div role="group" aria-label="Tipo de tinta" className={styles.modoTinta}>
              <button
                type="button"
                className={styles.botaoSecundario}
                aria-pressed={modoTinta === 'cor'}
                onClick={() => setModoTinta('cor')}
              >
                Cor
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                aria-pressed={modoTinta === 'imagem'}
                onClick={() => setModoTinta('imagem')}
              >
                Imagem
              </button>
              <button
                type="button"
                className={styles.botaoSecundario}
                aria-pressed={modoTinta === 'remover'}
                onClick={() => setModoTinta('remover')}
              >
                Remover
              </button>
            </div>
          </div>

          {modoTinta === 'cor' && (
            <label className={styles.corTinta}>
              <input type="color" value={corTinta} onChange={(e) => setCorTinta(e.target.value)} />
              {corTinta}
            </label>
          )}

          {modoTinta === 'imagem' && (
            <div className={styles.painelPinturaImagem}>
              <div className={styles.previewMaterial}>
                {imagemTinta ? (
                  ehCorSolida(imagemTinta) ? (
                    <span className={styles.previewSwatch} style={{ background: imagemTinta }} aria-hidden />
                  ) : (
                    <img className={styles.previewSwatch} src={imagemTinta} alt="" />
                  )
                ) : (
                  <span className={styles.previewSwatch} aria-hidden />
                )}
                <span className={styles.infoParede}>{nomeImagemTinta ?? 'Nenhuma textura escolhida'}</span>
                <button
                  type="button"
                  className={styles.botaoSecundario}
                  disabled={carregandoImagemTinta}
                  onClick={() => inputImagemTintaRef.current?.click()}
                >
                  {carregandoImagemTinta ? 'Carregando…' : 'Importar…'}
                </button>
                <input
                  ref={inputImagemTintaRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = '';
                    if (arquivo) void importarImagemTinta(arquivo);
                  }}
                />
              </div>

              {importandoTexturaAutomaticamente && <p role="status">Importando texturas novas encontradas na pasta do servidor…</p>}
              {texturasSalvas.isPending ? (
                <p className={styles.dicaParede}>Carregando texturas…</p>
              ) : texturasSalvas.isError ? (
                <p className={styles.dicaParede} role="alert">
                  Não foi possível carregar as texturas.
                </p>
              ) : texturasSalvas.data.length === 0 ? (
                <p className={styles.dicaParede}>Nenhuma textura salva ainda — importe uma imagem acima.</p>
              ) : (
                <ul className={styles.gradeTexturas}>
                  {texturasSalvas.data.map((textura) => (
                    <li key={textura.id}>
                      <button
                        type="button"
                        className={textura.url === imagemTinta ? styles.itemTexturaAtivo : styles.itemTextura}
                        title="Usar esta textura"
                        onClick={() => {
                          setImagemTinta(textura.url);
                          setNomeImagemTinta('Textura salva');
                          setErroTinta(null);
                        }}
                      >
                        <img className={styles.imagemTextura} src={textura.url} alt="" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <p className={styles.dicaParede}>
            {modoTinta === 'remover'
              ? 'Clique numa face pra tirar a textura dela'
              : 'Clique numa face da peça, parede ou piso pra aplicar'}
          </p>

          {selecionada &&
            elementos[selecionada]?.gruposDeFace &&
            Object.keys(elementos[selecionada].gruposDeFace).length > 0 && (
              <div className={styles.gruposPintura}>
                <span className={styles.infoParede}>Pintar grupo:</span>
                {Object.keys(elementos[selecionada].gruposDeFace)
                  .sort()
                  .map((nomeGrupo) => (
                    <button
                      key={nomeGrupo}
                      type="button"
                      className={styles.botaoSecundario}
                      disabled={modoTinta === 'imagem' && !imagemTinta}
                      onClick={() =>
                        onPintarGrupo(
                          selecionada,
                          nomeGrupo,
                          modoTinta === 'cor' ? corTinta : modoTinta === 'imagem' ? imagemTinta : null,
                        )
                      }
                    >
                      {nomeGrupo}
                    </button>
                  ))}
              </div>
            )}

          {erroTinta && (
            <p className={styles.dicaParede} role="alert">
              {erroTinta}
            </p>
          )}
        </div>
      ) : (
        <span className={styles.dica}>{dica}</span>
      )}
    </div>
  );
}
