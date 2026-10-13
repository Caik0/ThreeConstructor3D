using System.ComponentModel.DataAnnotations;
using construtor_3d_api.Models;

namespace construtor_3d_api.Dtos;

// Campos anuláveis + [Required] fazem a API recusar (400) quando o campo não é enviado,
// em vez de assumir o valor padrão do enum
public record FormaDto(
    [Required] TipoForma? Tipo,
    [Required] Dictionary<string, double>? Parametros);

// Relativa ao elemento pai, em mm
public record PosicaoDto(
    [Range(-Formas.LimitePosicao, Formas.LimitePosicao)] double X,
    [Range(-Formas.LimitePosicao, Formas.LimitePosicao)] double Y,
    [Range(-Formas.LimitePosicao, Formas.LimitePosicao)] double Z);

// Rotação em graus em torno da origem, relativa ao pai
public record RotacaoDto(
    [Range(-360, 360)] double X,
    [Range(-360, 360)] double Y,
    [Range(-360, 360)] double Z);

// Medidas fixas de um grupo, em mm, a partir da origem dele. O limite usa a mesma folga de
// Formas.ParedeComprimentoMaximo: o tamanho de um grupo de paredes já vem com a espessura somada,
// não é o contorno bruto desenhado
public record TamanhoDto(
    [Range(Formas.MedidaMinima, Formas.TamanhoMaximoGrupo + Formas.MedidaMaxima)] double X,
    [Range(Formas.MedidaMinima, Formas.TamanhoMaximoGrupo + Formas.MedidaMaxima)] double Y,
    [Range(Formas.MedidaMinima, Formas.TamanhoMaximoGrupo + Formas.MedidaMaxima)] double Z);

// Vão retangular numa parede (porta ou janela): sem folha nem vidro, só o buraco. É um elemento
// próprio, filho da parede — a posição dele (Posicao no ElementoRequest/Response) já é o
// deslocamento/peitoril, relativos à origem da parede-mãe; aqui só o que é próprio do vão. A
// validação contra o tamanho da própria parede (não passar da borda nem do teto) é feita à parte,
// em Formas.ValidarAbertura — os limites aqui são só a faixa genérica de qualquer medida
public record AberturaDto(
    [Required] TipoAbertura? Tipo,
    [Range(Formas.MedidaMinima, Formas.MedidaMaxima)] double Largura,
    [Range(Formas.MedidaMinima, Formas.MedidaMaxima)] double Altura);

// Medidas de uma parede, em mm, a partir da origem: comprimento no eixo local X,
// altura em Y, espessura em Z
public record ParedeDto(
    [Range(Formas.MedidaMinima, Formas.ParedeComprimentoMaximo)] double Comprimento,
    [Range(Formas.MedidaMinima, Formas.MedidaMaxima)] double Altura,
    [Range(Formas.MedidaMinima, Formas.MedidaMaxima)] double Espessura);

// Piso criado automaticamente ao fechar um contorno de paredes: o polígono que preenche a área
// interna (cantos relativos à origem do próprio piso) e a espessura, em mm
public record PisoDto(
    [Required] List<PosicaoDto>? Vertices,
    [Range(Formas.MedidaMinima, Formas.MedidaMaxima)] double Espessura);

public record CriarProjetoRequest(
    [Required, MaxLength(100)] string? Nome,
    [MaxLength(500)] string? Descricao,
    [Required] PontoPartida? PontoPartida,
    // Planta do ambiente (X largura, Y pé-direito, Z profundidade): opcional, o assistente de
    // criação não pede mais isso — o projeto nasce sem peças e sem planta, como um módulo
    TamanhoDto? Planta);

public record ElementoRequest(
    // Ausente em elementos novos; presente nos já salvos
    int? Id,
    [Required] TipoElemento? Tipo,
    [Required, MaxLength(60)] string? Nome,
    [Required] PosicaoDto? Posicao,
    // Ausente = sem rotação
    RotacaoDto? Rotacao,
    // Ausente = sem colisão (false)
    bool? Colisao,
    // Ausente = visível (true)
    bool? Visivel,
    // Peças têm Forma OU Modelo3d (nunca os dois); ignorados nos demais tipos
    FormaDto? Forma,
    // Peça importada de um .glb: a URL do arquivo já salvo (releitura, ou atualização sem
    // trocar o arquivo), ou os bytes em base64 de um arquivo novo (import ou criação) — os dois
    // cabem no mesmo campo de texto; ArquivosElemento decide qual é qual e grava o arquivo
    // quando for conteúdo novo
    string? Modelo3d,
    // Caminho da malha desta peça dentro do arquivo de Modelo3d (ex.: "2.0.1") — várias peças
    // podem apontar pro mesmo Modelo3d, cada uma com o caminho da parte dela
    string? Modelo3dNo,
    // Grupos: medidas fixas do grupo. Peças com Modelo3d: o tamanho da malha (calculado uma vez
    // na importação; ver Formas.ValidarModelo3d)
    TamanhoDto? Tamanho,
    // Obrigatória em paredes; ignorada nos demais tipos
    ParedeDto? Parede,
    // Obrigatório em pisos; ignorado nos demais tipos
    PisoDto? Piso,
    // Obrigatório em vãos; ignorado nos demais tipos
    AberturaDto? Abertura,
    // Fórmulas ao vivo dos campos numéricos deste elemento (ex.: "posicaoX" -> "Parent!largura/2")
    Dictionary<string, string>? Formulas,
    // Variáveis customizadas do elemento: nome -> texto digitado (número ou fórmula)
    Dictionary<string, string>? VariaveisFormulas,
    // Variáveis customizadas de uma face específica: face -> nome -> texto digitado
    Dictionary<string, Dictionary<string, string>>? VariaveisPorFaceFormulas,
    // Campos travados: não mudam quando um grupo pai é redimensionado
    List<string>? Travados,
    // Texturas JPEG por face (data URLs): face -> imagem
    Dictionary<string, string>? Texturas,
    // Só em grupos: grupos de face (ex.: "Caixa" -> a face "esquerda" da peça X + a "direita" da
    // peça Y), pra pintar faces de vários descendentes do grupo de uma vez no balde de tinta
    Dictionary<string, List<MembroGrupoDeFace>>? GruposDeFace,
    // Código interno (nunca mostrado na interface) gerado ao entrar num grupo de face pela
    // primeira vez; ver Elemento.ReferenciaEstavel
    string? ReferenciaEstavel,
    // Etiqueta do módulo (só peça/grupo): código único (regenerado ao duplicar) e/ou número de
    // ordem entre os módulos do projeto ("M-4"); ver Elemento.IdUnico/IdSequencial
    string? IdUnico,
    string? IdSequencial,
    // Só nos grupos de paredes: os cantos originalmente clicados (relativos à origem do grupo) e
    // se o contorno estava fechado, pra poder reabrir e editar depois
    List<PosicaoDto>? VerticesParede,
    bool? VerticesParedeFechado,
    // Conteúdo dos grupos e peças (qualquer elemento) e das paredes (só vãos); pisos e vãos não têm
    List<ElementoRequest>? Filhos);

// Árvore completa do projeto (elementos salvos que não vierem são removidos) e as variáveis
// globais dele, salvas juntas num único passo
public record SalvarElementosRequest(
    [Required] List<ElementoRequest>? Elementos,
    // Nome -> valor; ausente ou nulo esvazia (nenhuma variável global no projeto)
    Dictionary<string, double>? VariaveisGlobais);

public record ElementoResponse(
    int Id,
    TipoElemento Tipo,
    string Nome,
    PosicaoDto Posicao,
    RotacaoDto Rotacao,
    bool Colisao,
    bool Visivel,
    FormaDto? Forma,
    // Sempre a URL do arquivo (nunca o conteúdo em si, ao contrário de ElementoRequest)
    string? Modelo3d,
    string? Modelo3dNo,
    TamanhoDto? Tamanho,
    ParedeDto? Parede,
    PisoDto? Piso,
    AberturaDto? Abertura,
    Dictionary<string, string>? Formulas,
    Dictionary<string, string>? VariaveisFormulas,
    Dictionary<string, Dictionary<string, string>>? VariaveisPorFaceFormulas,
    List<string>? Travados,
    Dictionary<string, string>? Texturas,
    Dictionary<string, List<MembroGrupoDeFace>>? GruposDeFace,
    string? ReferenciaEstavel,
    string? IdUnico,
    string? IdSequencial,
    List<PosicaoDto>? VerticesParede,
    bool? VerticesParedeFechado,
    List<ElementoResponse> Filhos);

public record ProjetoResumoResponse(
    int Id,
    string Nome,
    string? Descricao,
    PontoPartida PontoPartida,
    int TotalPecas,
    DateTime CriadoEm,
    DateTime AtualizadoEm);

public record ProjetoResponse(
    int Id,
    string Nome,
    string? Descricao,
    PontoPartida PontoPartida,
    // Nula em projetos criados antes de a planta existir
    TamanhoDto? Planta,
    // Nula em projetos sem nenhuma variável global criada ainda
    Dictionary<string, double>? VariaveisGlobais,
    List<ElementoResponse> Elementos,
    DateTime CriadoEm,
    DateTime AtualizadoEm);
