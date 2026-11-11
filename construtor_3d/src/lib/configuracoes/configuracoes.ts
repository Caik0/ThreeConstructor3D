import type { UnidadeMedida } from '../../store/unidadeStore';

// CONFIGURAÇÕES DO USUÁRIO: atalhos e preferências do editor. Ficam guardadas por usuário na API
// (ver ConfiguracoesController) e em cache no navegador (ver store/configuracoesStore.ts). A API não
// conhece o formato: tudo é definido e validado AQUI. Dado inválido ou ausente cai no padrão, campo
// a campo, então um campo novo nunca quebra a configuração já salva de alguém.

/** O que um atalho de tecla faz no editor (Ctrl+S, Ctrl+Z, Ctrl+Y e Esc são fixos) */
export type AcaoDeAtalho = 'selecionar' | 'mover' | 'girar' | 'parede' | 'trena' | 'pintura' | 'remover';

export const ACOES_DE_ATALHO: { id: AcaoDeAtalho; rotulo: string; descricao: string }[] = [
  { id: 'selecionar', rotulo: 'Ferramenta Selecionar', descricao: 'Volta para a seleção de elementos' },
  { id: 'mover', rotulo: 'Ferramenta Mover', descricao: 'Mostra as setas para mover o elemento' },
  { id: 'girar', rotulo: 'Ferramenta Girar', descricao: 'Mostra os anéis para girar o elemento' },
  { id: 'parede', rotulo: 'Ferramenta Parede', descricao: 'Abre o construtor de paredes' },
  { id: 'trena', rotulo: 'Ferramenta Trena', descricao: 'Mede distâncias' },
  { id: 'pintura', rotulo: 'Ferramenta Pintura', descricao: 'Balde de tinta' },
  { id: 'remover', rotulo: 'Remover elemento', descricao: 'Remove o elemento selecionado' },
];

/** Atalhos fixos, que não podem ser trocados (aparecem na tela só como informação) */
export const ATALHOS_FIXOS: { teclas: string; descricao: string }[] = [
  { teclas: 'Ctrl/⌘ + S', descricao: 'Salvar' },
  { teclas: 'Ctrl/⌘ + Z', descricao: 'Desfazer' },
  { teclas: 'Ctrl/⌘ + Shift + Z ou Ctrl/⌘ + Y', descricao: 'Refazer' },
  { teclas: 'Esc', descricao: 'Limpar a seleção e depois sair do grupo aberto' },
];

/** O que um botão do mouse faz na cena ao ser mantido pressionado e arrastado */
export type AcaoDoMouse = 'orbitar' | 'pan' | 'zoom' | 'nenhuma';

export const ACOES_DO_MOUSE: { id: AcaoDoMouse; rotulo: string }[] = [
  { id: 'orbitar', rotulo: 'Orbitar (girar a câmera)' },
  { id: 'pan', rotulo: 'Pan (deslocar a câmera)' },
  { id: 'zoom', rotulo: 'Zoom (aproximar e afastar)' },
  { id: 'nenhuma', rotulo: 'Nenhuma' },
];

export type BotaoDoMouse = 'esquerdo' | 'meio' | 'direito';

export const BOTOES_DO_MOUSE: { id: BotaoDoMouse; rotulo: string }[] = [
  { id: 'esquerdo', rotulo: 'Botão esquerdo' },
  { id: 'meio', rotulo: 'Botão do meio (roda)' },
  { id: 'direito', rotulo: 'Botão direito' },
];

export interface Configuracoes {
  /** Tecla de cada ação, sempre completa: letra/número em minúsculas ("v") ou nome ("delete") */
  atalhos: Record<AcaoDeAtalho, string>;
  /** O que cada botão do mouse faz ao ser arrastado sobre a cena (a roda continua dando zoom) */
  mouse: Record<BotaoDoMouse, AcaoDoMouse>;
  /** Passo do movimento com as setas, em mm */
  passoMovimento: number;
  /** Passo da rotação com os anéis, em graus */
  passoRotacao: number;
  /** Elemento arrastado gruda na face de um vizinho próximo */
  encaixeMagnetico: boolean;
  /** Ao marcar um canto da parede (do segundo em diante), o cursor vai pro campo de extensão */
  focarExtensaoDaParede: boolean;
  /** Unidade mostrada ao abrir um projeto ou módulo em que você ainda não escolheu outra; nula =
   * a padrão da empresa (ver `unidadePadraoEfetiva`) */
  unidadePadrao: UnidadeMedida | null;
}

export const CONFIGURACOES_PADRAO: Configuracoes = {
  atalhos: { selecionar: 'v', mover: 'm', girar: 'g', parede: 'p', trena: 't', pintura: 'b', remover: 'delete' },
  mouse: { esquerdo: 'pan', meio: 'zoom', direito: 'orbitar' },
  passoMovimento: 10,
  passoRotacao: 15,
  encaixeMagnetico: true,
  focarExtensaoDaParede: true,
  unidadePadrao: null,
};

export const PASSO_MOVIMENTO_LIMITES = { min: 0.1, max: 1000 } as const;
export const PASSO_ROTACAO_LIMITES = { min: 0.1, max: 90 } as const;

// Teclas que não podem virar atalho: modificadoras, as de navegação do navegador e as que o editor
// já usa pra outra coisa (Esc, Enter e Backspace nas ferramentas de desenho)
const TECLAS_PROIBIDAS = new Set([
  'control', 'shift', 'alt', 'meta', 'altgraph', 'capslock', 'dead', 'unidentified',
  'escape', 'enter', 'tab', ' ', 'backspace', 'contextmenu',
]);

/** A tecla pressionada como o editor a guarda e compara; null se não serve como atalho */
export function teclaDoEvento(e: Pick<KeyboardEvent, 'key'>): string | null {
  const tecla = e.key.toLowerCase();
  return TECLAS_PROIBIDAS.has(tecla) ? null : tecla;
}

/** Como a tecla aparece na tela ("V", "Delete") */
export function nomeDaTecla(tecla: string): string {
  if (tecla.length === 1) return tecla.toUpperCase();
  return tecla.charAt(0).toUpperCase() + tecla.slice(1);
}

const limitar = (valor: unknown, padrao: number, { min, max }: { min: number; max: number }) =>
  typeof valor === 'number' && Number.isFinite(valor) && valor >= min && valor <= max ? valor : padrao;

/** Junta o que veio salvo (API, cache) com o padrão, campo a campo, descartando o que for inválido.
 * Atalho inválido, repetido ou proibido volta ao padrão dele */
export function normalizarConfiguracoes(bruto: unknown): Configuracoes {
  const origem = (typeof bruto === 'object' && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const atalhosBrutos = (typeof origem.atalhos === 'object' && origem.atalhos !== null ? origem.atalhos : {}) as Record<string, unknown>;

  const atalhos = { ...CONFIGURACOES_PADRAO.atalhos };
  const usadas = new Set<string>();
  for (const { id } of ACOES_DE_ATALHO) {
    const valor = atalhosBrutos[id];
    const valida = typeof valor === 'string' && valor !== '' && teclaDoEvento({ key: valor }) === valor.toLowerCase();
    const tecla = valida ? (valor as string).toLowerCase() : CONFIGURACOES_PADRAO.atalhos[id];
    if (usadas.has(tecla)) {
      atalhos[id] = '';
    } else {
      atalhos[id] = tecla;
      usadas.add(tecla);
    }
  }
  // Uma repetida (dado antigo ou adulterado) fica sem tecla; devolve ao padrão se der, senão fica sem
  for (const { id } of ACOES_DE_ATALHO) {
    if (atalhos[id] === '') {
      const padrao = CONFIGURACOES_PADRAO.atalhos[id];
      if (!usadas.has(padrao)) {
        atalhos[id] = padrao;
        usadas.add(padrao);
      }
    }
  }

  const mouseBruto = (typeof origem.mouse === 'object' && origem.mouse !== null ? origem.mouse : {}) as Record<string, unknown>;
  const mouse = { ...CONFIGURACOES_PADRAO.mouse };
  for (const { id } of BOTOES_DO_MOUSE) {
    const valor = mouseBruto[id];
    if (ACOES_DO_MOUSE.some((a) => a.id === valor)) mouse[id] = valor as AcaoDoMouse;
  }

  const unidade = origem.unidadePadrao;
  return {
    atalhos,
    mouse,
    passoMovimento: limitar(origem.passoMovimento, CONFIGURACOES_PADRAO.passoMovimento, PASSO_MOVIMENTO_LIMITES),
    passoRotacao: limitar(origem.passoRotacao, CONFIGURACOES_PADRAO.passoRotacao, PASSO_ROTACAO_LIMITES),
    encaixeMagnetico: typeof origem.encaixeMagnetico === 'boolean' ? origem.encaixeMagnetico : CONFIGURACOES_PADRAO.encaixeMagnetico,
    focarExtensaoDaParede:
      typeof origem.focarExtensaoDaParede === 'boolean' ? origem.focarExtensaoDaParede : CONFIGURACOES_PADRAO.focarExtensaoDaParede,
    unidadePadrao: unidade === 'mm' || unidade === 'cm' || unidade === 'm' ? unidade : null,
  };
}

/** Qual ação uma tecla aciona (null se nenhuma) */
export function acaoDoAtalho(atalhos: Configuracoes['atalhos'], tecla: string): AcaoDeAtalho | null {
  return ACOES_DE_ATALHO.find((a) => atalhos[a.id] === tecla)?.id ?? null;
}
