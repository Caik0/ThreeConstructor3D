using System.Security.Cryptography;

namespace construtor_3d_api.Services;

// Guarda os arquivos numa pasta local (ver Armazenamento:Diretorio no appsettings; em produção é
// um volume do Docker, pra sobreviver a um rebuild do container), separados por tipo em subpastas
// (ex.: media/modelos3d, media/texturas). Program.cs serve essa mesma pasta (com as subpastas) como
// arquivos estáticos em CaminhoPublico
//
// O nome do arquivo é o hash do próprio conteúdo (SHA-256), não um número aleatório: é a "base"
// guardada uma vez só — um mesmo .glb ou uma mesma imagem, não importa quantas vezes seja
// importado/pintado ou em quantos projetos apareça, vira sempre o mesmo arquivo, nunca uma cópia
// nova. Cada elemento guarda a URL dele, e as alterações de cada projeto (tamanho, posição, qual
// face usa qual textura) continuam só no banco — o arquivo em si nunca é reescrito
public class ArmazenamentoLocalArquivos : IArmazenamentoArquivos
{
    public const string CaminhoPublico = "/api/media";

    // Nomes das subpastas por tipo de arquivo, reaproveitados por ArquivosElemento
    public const string PastaModelos3d = "modelos3d";
    public const string PastaTexturas = "texturas";

    private readonly string _diretorio;

    public ArmazenamentoLocalArquivos(IConfiguration configuracao)
    {
        _diretorio = Path.GetFullPath(configuracao["Armazenamento:Diretorio"] ?? "media");
        Directory.CreateDirectory(_diretorio);
    }

    public async Task<string> SalvarAsync(byte[] dados, string extensao, string pasta)
    {
        var diretorioDestino = Path.Combine(_diretorio, pasta);
        Directory.CreateDirectory(diretorioDestino);

        var hash = Convert.ToHexString(SHA256.HashData(dados)).ToLowerInvariant();
        var nome = $"{hash}{extensao}";
        var caminho = Path.Combine(diretorioDestino, nome);
        // Mesmo conteúdo já gravado antes (mesmo hash): reaproveita o arquivo que já existe, não
        // escreve de novo — é assim que a mesma base nunca vira uma cópia nova
        if (!File.Exists(caminho)) await File.WriteAllBytesAsync(caminho, dados);
        return $"{CaminhoPublico}/{pasta}/{nome}";
    }

    public async Task<string> SalvarStreamAsync(Stream origem, string extensao, string pasta)
    {
        var diretorioDestino = Path.Combine(_diretorio, pasta);
        Directory.CreateDirectory(diretorioDestino);

        // Só dá pra saber o nome definitivo (hash do conteúdo) depois de ler o arquivo inteiro —
        // grava num nome temporário primeiro e renomeia no final, igual SalvarAsync faz de uma vez
        // só com o array pronto
        var temporario = Path.Combine(diretorioDestino, $".tmp-{Guid.NewGuid():N}");
        try
        {
            using var sha256 = SHA256.Create();
            await using (var destino = new FileStream(
                temporario, FileMode.CreateNew, FileAccess.Write, FileShare.None, 81920, useAsync: true))
            await using (var comHash = new CryptoStream(destino, sha256, CryptoStreamMode.Write))
            {
                await origem.CopyToAsync(comHash);
            }

            var hash = Convert.ToHexString(sha256.Hash!).ToLowerInvariant();
            var nome = $"{hash}{extensao}";
            var caminho = Path.Combine(diretorioDestino, nome);
            // Mesmo conteúdo já gravado antes (mesmo hash): descarta o temporário, reaproveita o
            // arquivo que já existe — mesma regra de dedup de SalvarAsync
            if (File.Exists(caminho)) File.Delete(temporario);
            else File.Move(temporario, caminho);
            return $"{CaminhoPublico}/{pasta}/{nome}";
        }
        catch
        {
            if (File.Exists(temporario)) File.Delete(temporario);
            throw;
        }
    }

    public void Excluir(string url)
    {
        if (!url.StartsWith(CaminhoPublico + "/", StringComparison.Ordinal)) return;
        // "modelos3d/xxxx.glb" ou "texturas/xxxx.jpg" — o resto da URL depois do caminho público
        var relativo = url[(CaminhoPublico.Length + 1)..].Replace('/', Path.DirectorySeparatorChar);
        var caminho = Path.Combine(_diretorio, relativo);
        if (File.Exists(caminho)) File.Delete(caminho);
    }
}
