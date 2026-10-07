import type { Usuario } from '../auth/auth';

// Mesmas chaves de Models/Permissoes.cs no backend — qualquer chave nova precisa ser adicionada
// nos dois lados. As 5 marcadas "grossa" lá também são checadas no backend (as outras só
// escondem/mostram ferramentas aqui no editor, ver store/editorStore.ts)
export const PERMISSOES = {
  // Grossas (checadas também no backend)
  PROJETOS_CRIAR: 'projetos.criar',
  PROJETOS_EXCLUIR: 'projetos.excluir',
  PROJETOS_EDITAR_ELEMENTOS: 'projetos.editarElementos',
  MODULOS_GERENCIAR: 'modulos.gerenciar',
  MODULOS_EXCLUIR: 'modulos.excluir',

  // Ferramentas de modo (BarraFerramentas)
  FERRAMENTA_MOVER: 'ferramenta.mover',
  FERRAMENTA_GIRAR: 'ferramenta.girar',
  FERRAMENTA_PAREDE: 'ferramenta.parede',
  FERRAMENTA_TRENA: 'ferramenta.trena',
  FERRAMENTA_PINTURA: 'ferramenta.pintura',

  // Árvore de elementos
  ESTRUTURA_CRIAR_FORMA: 'estrutura.criarForma',
  ESTRUTURA_CRIAR_GRUPO: 'estrutura.criarGrupo',
  ESTRUTURA_CRIAR_PAREDE: 'estrutura.criarParede',
  ESTRUTURA_IMPORTAR_MODULO: 'estrutura.importarModulo',
  ESTRUTURA_SALVAR_COMO_MODULO: 'estrutura.salvarComoModulo',
  ESTRUTURA_AGRUPAR: 'estrutura.agrupar',
  ESTRUTURA_DUPLICAR: 'estrutura.duplicar',
  ESTRUTURA_REMOVER: 'estrutura.remover',
  ESTRUTURA_VISIBILIDADE: 'estrutura.visibilidade',

  // Painel de propriedades do elemento
  ELEMENTO_EDITAR_NOME_COLISAO: 'elemento.editarNomeColisao',
  ELEMENTO_REDIMENSIONAR: 'elemento.redimensionar',
  ELEMENTO_POSICAO_ROTACAO: 'elemento.posicaoRotacao',
  ELEMENTO_VAOS: 'elemento.vaos',
  ELEMENTO_VARIAVEIS_FORMULAS: 'elemento.variaveisFormulas',
  ELEMENTO_CONFIGURAR_FACES: 'elemento.configurarFaces',

  // Diversos
  PROJETO_VARIAVEIS_GLOBAIS: 'projeto.variaveisGlobais',
  MODULO_GERAR_ID: 'modulo.gerarId',
} as const;

export type PermissaoChave = (typeof PERMISSOES)[keyof typeof PERMISSOES];

interface DescricaoPermissao {
  chave: PermissaoChave;
  grupo: string;
  rotulo: string;
}

// Catálogo completo, usado pra montar os checkboxes agrupados na tela de administração
export const CATALOGO_PERMISSOES: DescricaoPermissao[] = [
  { chave: PERMISSOES.PROJETOS_CRIAR, grupo: 'Projetos', rotulo: 'Criar novos projetos' },
  { chave: PERMISSOES.PROJETOS_EXCLUIR, grupo: 'Projetos', rotulo: 'Excluir projetos' },
  {
    chave: PERMISSOES.PROJETOS_EDITAR_ELEMENTOS,
    grupo: 'Projetos',
    rotulo: 'Editar elementos de um projeto (mover, desenhar, pintar, redimensionar etc.)',
  },
  { chave: PERMISSOES.MODULOS_GERENCIAR, grupo: 'Módulos', rotulo: 'Salvar, renomear e importar módulos (.glb)' },
  { chave: PERMISSOES.MODULOS_EXCLUIR, grupo: 'Módulos', rotulo: 'Excluir módulos' },

  { chave: PERMISSOES.FERRAMENTA_MOVER, grupo: 'Ferramentas', rotulo: 'Mover' },
  { chave: PERMISSOES.FERRAMENTA_GIRAR, grupo: 'Ferramentas', rotulo: 'Girar' },
  { chave: PERMISSOES.FERRAMENTA_PAREDE, grupo: 'Ferramentas', rotulo: 'Desenhar parede' },
  { chave: PERMISSOES.FERRAMENTA_TRENA, grupo: 'Ferramentas', rotulo: 'Trena (medir)' },
  { chave: PERMISSOES.FERRAMENTA_PINTURA, grupo: 'Ferramentas', rotulo: 'Balde de tinta (pintar)' },

  { chave: PERMISSOES.ESTRUTURA_CRIAR_FORMA, grupo: 'Estrutura', rotulo: 'Criar peça (forma paramétrica)' },
  { chave: PERMISSOES.ESTRUTURA_CRIAR_GRUPO, grupo: 'Estrutura', rotulo: 'Criar grupo' },
  { chave: PERMISSOES.ESTRUTURA_CRIAR_PAREDE, grupo: 'Estrutura', rotulo: 'Criar parede avulsa' },
  { chave: PERMISSOES.ESTRUTURA_IMPORTAR_MODULO, grupo: 'Estrutura', rotulo: 'Importar módulo salvo' },
  { chave: PERMISSOES.ESTRUTURA_SALVAR_COMO_MODULO, grupo: 'Estrutura', rotulo: 'Salvar como módulo' },
  { chave: PERMISSOES.ESTRUTURA_AGRUPAR, grupo: 'Estrutura', rotulo: 'Agrupar/desagrupar' },
  { chave: PERMISSOES.ESTRUTURA_DUPLICAR, grupo: 'Estrutura', rotulo: 'Duplicar elemento' },
  { chave: PERMISSOES.ESTRUTURA_REMOVER, grupo: 'Estrutura', rotulo: 'Remover elemento' },
  { chave: PERMISSOES.ESTRUTURA_VISIBILIDADE, grupo: 'Estrutura', rotulo: 'Mostrar/ocultar elementos' },

  { chave: PERMISSOES.ELEMENTO_EDITAR_NOME_COLISAO, grupo: 'Elemento', rotulo: 'Editar nome e colisão' },
  {
    chave: PERMISSOES.ELEMENTO_REDIMENSIONAR,
    grupo: 'Elemento',
    rotulo: 'Redimensionar (medidas, forma, quinas, piso, parede)',
  },
  { chave: PERMISSOES.ELEMENTO_POSICAO_ROTACAO, grupo: 'Elemento', rotulo: 'Editar posição e rotação' },
  { chave: PERMISSOES.ELEMENTO_VAOS, grupo: 'Elemento', rotulo: 'Adicionar/editar vãos (portas e janelas)' },
  {
    chave: PERMISSOES.ELEMENTO_VARIAVEIS_FORMULAS,
    grupo: 'Elemento',
    rotulo: 'Editar variáveis e fórmulas (inclui por face)',
  },
  { chave: PERMISSOES.ELEMENTO_CONFIGURAR_FACES, grupo: 'Elemento', rotulo: 'Configurar grupos de face' },

  { chave: PERMISSOES.PROJETO_VARIAVEIS_GLOBAIS, grupo: 'Outros', rotulo: 'Variáveis globais do projeto' },
  { chave: PERMISSOES.MODULO_GERAR_ID, grupo: 'Outros', rotulo: 'Gerar ID único/sequencial de módulo' },
];

/** Função pura (sem hook) pra checagens fora de componente, ex. filtrar um array de ferramentas */
export function temPermissao(usuario: Usuario | null | undefined, chave: PermissaoChave): boolean {
  if (!usuario) return false;
  return usuario.admin || (usuario.permissoes?.includes(chave) ?? false);
}
