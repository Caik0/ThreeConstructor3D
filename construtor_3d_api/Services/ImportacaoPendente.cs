namespace construtor_3d_api.Services;

// Pasta onde um arquivo solto (arrastado direto pro disco, sem passar pela tela de importar) —
// um .glb ou uma imagem — espera virar módulo ou textura sozinho (ver GET /api/modulos/pendentes
// e GET /api/texturas/pendentes). Só o front sabe processar o conteúdo (.glb usa o three.js do
// navegador, ver lib/modelo3d/importarGlb.ts; imagem só é reenviada como está), então esta classe
// só lista o que está pendente (por extensão, ver Listar) e move o arquivo pra fora da fila depois
// que o front processa (com sucesso ou não) — nunca abre o conteúdo do arquivo em si
public class ImportacaoPendente
{
    public const string CaminhoPublico = "/api/importar";

    private readonly string _diretorio;

    public ImportacaoPendente(IConfiguration configuracao)
    {
        _diretorio = Path.GetFullPath(configuracao["Armazenamento:DiretorioImportacao"] ?? "importar");
        Directory.CreateDirectory(_diretorio);
    }

    public string Diretorio => _diretorio;

    /// <summary>Arquivos direto na pasta (não desce em processados/com-erro) que casam com algum
    /// dos padrões dados — ex.: "*.glb" pra módulos, "*.jpg"/"*.jpeg" pra texturas</summary>
    public List<(string Nome, string Url)> Listar(params string[] padroes) =>
        padroes
            .SelectMany(padrao => Directory.EnumerateFiles(_diretorio, padrao, SearchOption.TopDirectoryOnly))
            .Select(Path.GetFileName)
            .Where(nome => nome is not null)
            .Select(nome => (nome!, $"{CaminhoPublico}/{nome}"))
            .OrderBy(p => p.Item1, StringComparer.Ordinal)
            .ToList();

    /// <summary>Tira `nome` da fila, movendo pra "processados" (virou módulo) ou "com-erro"
    /// (arquivo inválido, ou algo deu errado) — nos dois casos não tenta de novo sozinho depois</summary>
    public void Concluir(string nome, bool sucesso)
    {
        var origem = Path.Combine(_diretorio, nome);
        if (!File.Exists(origem)) return;

        var destinoDir = Path.Combine(_diretorio, sucesso ? "processados" : "com-erro");
        Directory.CreateDirectory(destinoDir);
        var destino = Path.Combine(destinoDir, nome);
        if (File.Exists(destino)) File.Delete(destino);
        File.Move(origem, destino);
    }
}
