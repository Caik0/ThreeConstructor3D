using System.Text.RegularExpressions;
using construtor_3d_api.Dtos;
using construtor_3d_api.Services;

namespace construtor_3d_api.Models;

// Mesmas regras de src/lib/formas/formas.ts no front
public static partial class Formas
{
    // A precisão do editor é de 0,1 mm (ver arredondar no front); esse já é o mínimo possível
    public const double MedidaMinima = 0.1;
    public const double MedidaMaxima = 5000;
    public const double TamanhoMaximoGrupo = 20000;
    // O encontro de paredes (construirSegmentosParede no front) estende cada segmento um pouco além
    // do canto bruto desenhado, pela metade da espessura da parede — por isso qualquer limite
    // comparado com uma medida já "assada" (comprimento de parede, posição, tamanho do grupo)
    // precisa dessa folga de MedidaMaxima por cima do valor bruto, senão um cômodo desenhado bem no
    // limite nominal sempre estoura o limite de verdade
    public const double ParedeComprimentoMaximo = TamanhoMaximoGrupo + MedidaMaxima;
    public const double LimitePosicao = TamanhoMaximoGrupo + MedidaMaxima;
    public const int MaximoElementos = 500;
    public const int ProfundidadeMaxima = 12;
    // Fórmulas e variáveis customizadas (Parent!...): limites generosos só pra evitar abuso,
    // o front já não deixa passar disso na prática
    public const int FormulaComprimentoMaximo = 200;
    public const int VariaveisPorElementoMaximo = 20;
    public const int FormulasPorElementoMaximo = 20;
    public const int NomeVariavelComprimentoMaximo = 40;
    // Etiqueta do módulo (IdUnico/IdSequencial): "2945888" ou "M-12" cabem de sobra
    public const int IdModuloComprimentoMaximo = 20;
    public const int TravadosPorElementoMaximo = 40;
    // Texturas: uma imagem JPEG por face (o front já reduz e recomprime antes de enviar)
    public const int TexturaTamanhoMaximo = 3 * 1024 * 1024;
    public static readonly string[] FacesTextura = ["direita", "esquerda", "topo", "base", "frente", "fundo", "lateral"];
    // Grupo de face: um rótulo livre (ex.: "Caixa(s)"), não um identificador de fórmula — por
    // isso usa o mesmo tamanho de um nome de elemento, não de uma variável
    public const int GruposDeFaceMaximo = 20;
    public const int NomeGrupoDeFaceComprimentoMaximo = 60;
    const string PrefixoTextura = "data:image/jpeg;base64,";
    private static readonly Regex CorSolidaRegex = new("^#[0-9a-fA-F]{6}$", RegexOptions.Compiled);

    // Cor sólida (ex.: "#3a7bd5", como um <input type="color"> devolve): fica só no campo do
    // elemento, nunca vira arquivo nem entra no catálogo de texturas (ver ArquivosElemento)
    public static bool EhCorSolida(string valor) => CorSolidaRegex.IsMatch(valor);

    // `imagem` é o valor de cada face como chega na requisição: uma cor sólida, a URL de um arquivo
    // já salvo (já validada antes, nada a checar de novo) ou um data URL JPEG novo, ainda não salvo
    // (ver ArquivosElemento.ResolverTexturas)
    public static string? ValidarTexturas(Dictionary<string, string>? texturas)
    {
        if (texturas is null) return null;
        foreach (var (face, imagem) in texturas)
        {
            if (!FacesTextura.Contains(face)) return $"face de textura inválida: {face}.";
            if (ValidarImagemTextura(imagem) is string erro) return erro;
        }
        return null;
    }

    // Nome do grupo -> lista de membros (cada um a face de um descendente do grupo dono da lista,
    // ex.: "Caixa" -> a "esquerda" da peça X + a "direita" da peça Y), pra pintar todas de uma vez
    // no balde de tinta (ver Elemento.GruposDeFace). Não dá pra validar aqui se Chave realmente é
    // um descendente do elemento (essa checagem não tem a árvore à mão) — só o formato de cada
    // membro, como uma referência Parent! também não é validada contra a árvore de verdade
    public static string? ValidarGruposDeFace(Dictionary<string, List<MembroGrupoDeFace>>? grupos)
    {
        if (grupos is null) return null;
        if (grupos.Count > GruposDeFaceMaximo) return $"No máximo {GruposDeFaceMaximo} grupos de face por elemento.";
        foreach (var (nome, membros) in grupos)
        {
            if (nome.Length == 0 || nome.Length > NomeGrupoDeFaceComprimentoMaximo)
                return $"Nome de grupo de face inválido: {nome}.";
            if (membros.Any(membro => string.IsNullOrEmpty(membro.Referencia) || !FacesTextura.Contains(membro.Face)))
                return $"membro de grupo inválido no grupo {nome}.";
        }
        return null;
    }

    // Mesma checagem de cada valor de ValidarTexturas, sem o nome da face — usada também pra
    // importar uma textura direto pro catálogo, sem estar ligada a nenhum elemento (ver
    // TexturasController.Importar e ArquivosElemento.ResolverTexturaUnica)
    public static string? ValidarImagemTextura(string imagem)
    {
        if (EhCorSolida(imagem)) return null;
        if (imagem.StartsWith(ArmazenamentoLocalArquivos.CaminhoPublico + "/", StringComparison.Ordinal)) return null;
        if (!imagem.StartsWith(PrefixoTextura, StringComparison.Ordinal)) return "a textura precisa ser uma imagem JPEG ou uma cor (#rrggbb).";
        if (imagem.Length > TexturaTamanhoMaximo) return "textura grande demais.";
        return null;
    }
    // Cantos do construtor de paredes: bem mais generoso que o normal, já que cada clique vira
    // um só vértice (o limite de elementos do projeto já limita quantas paredes saem disso)
    public const int VerticesParedeMaximo = 200;
    // Cantos do piso: o mesmo contorno das paredes que o criaram
    public const int VerticesPisoMaximo = 200;
    // Vãos de porta/janela por parede
    public const int AberturasPorParedeMaximo = 20;
    // Tamanho máximo de um arquivo .glb importado como peça. Acima de ~2GB isso precisaria virar
    // long (o tipo do próprio limite estoura antes do arquivo)
    public const int Modelo3dTamanhoMaximo = 1024 * 1024 * 1024;

    // Limite do corpo da requisição multipart do upload de .glb (ver
    // ModulosController.EnviarModelo3dArquivo): um pouco acima de Modelo3dTamanhoMaximo pra sobrar
    // espaço pro overhead do multipart em si (boundary, cabeçalhos de cada parte) — o tamanho do
    // arquivo continua limitado por Modelo3dTamanhoMaximo, checado à parte depois de recebido
    public const int Modelo3dRequestTamanhoMaximo = Modelo3dTamanhoMaximo + 5 * 1024 * 1024;

    // Raio de cada quina vertical arredondada de uma caixa (0 = quina reta, como sempre foi);
    // limitado só pelo bom senso, o front ainda encolhe pra caber na metade da largura/profundidade
    public const double RaioCantosMaximo = 2500;

    // Cada parâmetro com sua própria faixa válida: a maioria usa a mesma de sempre
    // (MedidaMinima..MedidaMaxima), mas o raio de uma quina precisa aceitar zero (sem arredondar)
    private static readonly Dictionary<TipoForma, (string Nome, double Min, double Max)[]> ParametrosPorTipo = new()
    {
        [TipoForma.Caixa] =
        [
            ("largura", MedidaMinima, MedidaMaxima),
            ("altura", MedidaMinima, MedidaMaxima),
            ("profundidade", MedidaMinima, MedidaMaxima),
            ("raioFrenteDireita", 0, RaioCantosMaximo),
            ("raioFrenteEsquerda", 0, RaioCantosMaximo),
            ("raioFundoDireita", 0, RaioCantosMaximo),
            ("raioFundoEsquerda", 0, RaioCantosMaximo),
        ],
        [TipoForma.Cilindro] = [("diametro", MedidaMinima, MedidaMaxima), ("altura", MedidaMinima, MedidaMaxima)],
    };

    /// <summary>Retorna a mensagem de erro, ou null se os parâmetros forem válidos.</summary>
    public static string? Validar(TipoForma tipo, IReadOnlyDictionary<string, double> parametros)
    {
        var esperados = ParametrosPorTipo[tipo];
        var nomesEsperados = esperados.Select(p => p.Nome).ToArray();

        var ausentes = nomesEsperados.Where(p => !parametros.ContainsKey(p)).ToList();
        if (ausentes.Count > 0)
            return $"Parâmetros ausentes: {string.Join(", ", ausentes)}.";

        var desconhecidos = parametros.Keys.Except(nomesEsperados).ToList();
        if (desconhecidos.Count > 0)
            return $"Parâmetros não reconhecidos: {string.Join(", ", desconhecidos)}.";

        var foraDoIntervalo = esperados
            .Where(p => parametros[p.Nome] < p.Min || parametros[p.Nome] > p.Max)
            .Select(p => p.Nome)
            .ToList();
        if (foraDoIntervalo.Count > 0)
            return $"Medida fora do intervalo permitido: {string.Join(", ", foraDoIntervalo)}.";

        return null;
    }

    [GeneratedRegex("^[a-zA-Z_][a-zA-Z0-9_]*$")]
    private static partial Regex NomeDeVariavelRegex();

    /// <summary>
    /// Valida fórmulas e variáveis customizadas (o front já resolve o texto; aqui só limites
    /// generosos de tamanho/quantidade, pra um cliente que não passe pela validação do editor não
    /// conseguir gravar lixo enorme). Retorna a mensagem de erro, ou null se estiver tudo certo.
    /// </summary>
    public static string? ValidarFormulas(
        Dictionary<string, string>? formulas,
        Dictionary<string, string>? variaveis,
        Dictionary<string, Dictionary<string, string>>? variaveisPorFace = null)
    {
        if (formulas is { Count: > FormulasPorElementoMaximo })
            return $"No máximo {FormulasPorElementoMaximo} fórmulas por elemento.";
        if (formulas is not null && formulas.Values.Any(f => f.Length > FormulaComprimentoMaximo))
            return $"Fórmulas podem ter no máximo {FormulaComprimentoMaximo} caracteres.";

        if (ValidarVariaveis(variaveis) is string erroVariaveis) return erroVariaveis;

        if (variaveisPorFace is not null)
        {
            foreach (var (face, variaveisDaFace) in variaveisPorFace)
            {
                if (!FacesTextura.Contains(face)) return $"face de variável inválida: {face}.";
                if (ValidarVariaveis(variaveisDaFace) is string erroFace) return erroFace;
            }
        }

        return null;
    }

    private static string? ValidarVariaveis(Dictionary<string, string>? variaveis)
    {
        if (variaveis is { Count: > VariaveisPorElementoMaximo })
            return $"No máximo {VariaveisPorElementoMaximo} variáveis por elemento.";
        if (variaveis is not null)
        {
            var nomeInvalido = variaveis.Keys.FirstOrDefault(
                nome => nome.Length > NomeVariavelComprimentoMaximo || !NomeDeVariavelRegex().IsMatch(nome));
            if (nomeInvalido is not null)
                return $"Nome de variável inválido: {nomeInvalido}.";
            if (variaveis.Values.Any(f => f.Length > FormulaComprimentoMaximo))
                return $"Fórmulas de variáveis podem ter no máximo {FormulaComprimentoMaximo} caracteres.";
        }

        return null;
    }

    // Um projeto pode ter bem mais variáveis globais que um único elemento tem variáveis locais
    // (são compartilhadas por todo mundo), mas ainda um limite generoso só contra abuso
    public const int VariaveisGlobaisMaximo = 200;

    /// <summary>Nome (mesma regra de uma variável de elemento) e valor (só precisa ser um número
    /// de verdade — não é texto nem fórmula, ver Projeto.VariaveisGlobais) de cada variável
    /// global. Retorna a mensagem de erro, ou null se estiver tudo certo.</summary>
    public static string? ValidarVariaveisGlobais(Dictionary<string, double>? variaveis)
    {
        if (variaveis is null) return null;
        if (variaveis.Count > VariaveisGlobaisMaximo)
            return $"No máximo {VariaveisGlobaisMaximo} variáveis globais por projeto.";

        var nomeInvalido = variaveis.Keys.FirstOrDefault(
            nome => nome.Length > NomeVariavelComprimentoMaximo || !NomeDeVariavelRegex().IsMatch(nome));
        if (nomeInvalido is not null)
            return $"Nome de variável global inválido: {nomeInvalido}.";

        if (variaveis.Values.Any(v => !double.IsFinite(v)))
            return "Valor de variável global inválido.";

        return null;
    }

    // Assinatura binária de um .glb (glTF Binary): 4 bytes ASCII "glTF" no início do arquivo
    private static readonly byte[] AssinaturaGlb = "glTF"u8.ToArray();

    /// <summary>
    /// Valida o arquivo de uma peça importada de um .glb: tamanho e assinatura binária (não é uma
    /// validação completa do glTF, só uma checagem rápida contra arquivo errado/corrompido — quem
    /// realmente monta a malha é o three.js no navegador). `valor` é o campo Modelo3d como chega
    /// na requisição: uma URL de arquivo já salvo (já validado antes, nada a checar de novo) ou
    /// os bytes em base64 de um arquivo novo. Retorna a mensagem de erro, ou null.
    /// </summary>
    public static string? ValidarModelo3d(string valor)
    {
        if (valor.StartsWith(ArmazenamentoLocalArquivos.CaminhoPublico + "/", StringComparison.Ordinal))
            return null;

        byte[] dados;
        try
        {
            dados = Convert.FromBase64String(valor);
        }
        catch (FormatException)
        {
            return "O arquivo não parece ser um .glb válido.";
        }

        if (dados.Length == 0)
            return "O arquivo está vazio.";
        if (dados.Length > Modelo3dTamanhoMaximo)
            return $"O arquivo .glb pode ter no máximo {Modelo3dTamanhoMaximo / 1024 / 1024} MB.";
        if (dados.Length < AssinaturaGlb.Length || !dados.AsSpan(0, AssinaturaGlb.Length).SequenceEqual(AssinaturaGlb))
            return "O arquivo não parece ser um .glb válido.";

        return null;
    }

    /// <summary>
    /// Mesmas checagens de <see cref="ValidarModelo3d"/> (tamanho e assinatura glTF), mas pro
    /// upload via multipart (ver ModulosController.EnviarModelo3dArquivo): aqui o arquivo já chega
    /// como stream, então `tamanho` vem de IFormFile.Length e `primeirosBytes` são só os bytes já
    /// lidos do início do stream pra checar a assinatura — nunca o arquivo inteiro em memória
    /// </summary>
    public static string? ValidarModelo3dArquivo(long tamanho, ReadOnlySpan<byte> primeirosBytes)
    {
        if (tamanho == 0)
            return "O arquivo está vazio.";
        if (tamanho > Modelo3dTamanhoMaximo)
            return $"O arquivo .glb pode ter no máximo {Modelo3dTamanhoMaximo / 1024 / 1024} MB.";
        if (primeirosBytes.Length < AssinaturaGlb.Length || !primeirosBytes[..AssinaturaGlb.Length].SequenceEqual(AssinaturaGlb))
            return "O arquivo não parece ser um .glb válido.";

        return null;
    }

    /// <summary>
    /// Valida um vão (elemento filho de uma parede) contra o tamanho da parede-mãe (não passar da
    /// borda nem do teto). `posicao` é a do próprio elemento do vão: X é o deslocamento, Z é o
    /// peitoril. Retorna a mensagem de erro, ou null se estiver tudo certo.
    /// </summary>
    public static string? ValidarAbertura(AberturaDto abertura, PosicaoDto posicao, ParedeDto parede)
    {
        if (posicao.X < 0 || posicao.Z < 0)
            return "Um vão não pode ter deslocamento nem peitoril negativos.";
        if (posicao.X + abertura.Largura > parede.Comprimento || posicao.Z + abertura.Altura > parede.Altura)
            return "Um vão não cabe nas medidas da parede.";

        return null;
    }
}
