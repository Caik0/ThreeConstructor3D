namespace construtor_3d_api.Models;

// Catálogo de permissões granulares por ferramenta do editor. Mesmas chaves de
// src/lib/permissoes/permissoes.ts no front — qualquer chave nova precisa ser adicionada nos dois
// lados. A maioria só é checada no front (esconde a ferramenta); as 5 marcadas "grossa" abaixo
// também são checadas aqui, nos únicos endpoints que existem pra essas ações (ver
// PermissoesServico e os controllers que o chamam)
public static class Permissoes
{
    // Grossas: checadas no backend
    public const string ProjetosCriar = "projetos.criar";
    public const string ProjetosExcluir = "projetos.excluir";
    public const string ProjetosEditarElementos = "projetos.editarElementos";
    public const string ModulosGerenciar = "modulos.gerenciar";
    public const string ModulosExcluir = "modulos.excluir";

    // Ferramentas de modo (BarraFerramentas) — só front
    public const string FerramentaMover = "ferramenta.mover";
    public const string FerramentaGirar = "ferramenta.girar";
    public const string FerramentaParede = "ferramenta.parede";
    public const string FerramentaTrena = "ferramenta.trena";
    public const string FerramentaPintura = "ferramenta.pintura";

    // Árvore de elementos — só front
    public const string EstruturaCriarForma = "estrutura.criarForma";
    public const string EstruturaCriarGrupo = "estrutura.criarGrupo";
    public const string EstruturaCriarParede = "estrutura.criarParede";
    public const string EstruturaImportarModulo = "estrutura.importarModulo";
    public const string EstruturaSalvarComoModulo = "estrutura.salvarComoModulo";
    public const string EstruturaAgrupar = "estrutura.agrupar";
    public const string EstruturaDuplicar = "estrutura.duplicar";
    public const string EstruturaRemover = "estrutura.remover";
    public const string EstruturaVisibilidade = "estrutura.visibilidade";

    // Painel de propriedades do elemento — só front
    public const string ElementoEditarNomeColisao = "elemento.editarNomeColisao";
    public const string ElementoRedimensionar = "elemento.redimensionar";
    public const string ElementoPosicaoRotacao = "elemento.posicaoRotacao";
    public const string ElementoVaos = "elemento.vaos";
    public const string ElementoVariaveisFormulas = "elemento.variaveisFormulas";
    public const string ElementoConfigurarFaces = "elemento.configurarFaces";

    // Diversos — só front
    public const string ProjetoVariaveisGlobais = "projeto.variaveisGlobais";
    public const string ModuloGerarId = "modulo.gerarId";

    public static readonly string[] Todas =
    [
        ProjetosCriar, ProjetosExcluir, ProjetosEditarElementos, ModulosGerenciar, ModulosExcluir,
        FerramentaMover, FerramentaGirar, FerramentaParede, FerramentaTrena, FerramentaPintura,
        EstruturaCriarForma, EstruturaCriarGrupo, EstruturaCriarParede, EstruturaImportarModulo,
        EstruturaSalvarComoModulo, EstruturaAgrupar, EstruturaDuplicar, EstruturaRemover, EstruturaVisibilidade,
        ElementoEditarNomeColisao, ElementoRedimensionar, ElementoPosicaoRotacao, ElementoVaos,
        ElementoVariaveisFormulas, ElementoConfigurarFaces,
        ProjetoVariaveisGlobais, ModuloGerarId,
    ];

    public static bool EhValida(string chave) => Todas.Contains(chave);
}
