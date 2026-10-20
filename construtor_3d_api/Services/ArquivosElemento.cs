using Microsoft.EntityFrameworkCore;
using construtor_3d_api.Data;
using construtor_3d_api.Dtos;
using construtor_3d_api.Models;

namespace construtor_3d_api.Services;

// Resolve os campos de arquivo de um elemento (Modelo3d, Texturas) pro formato salvo no banco: só
// a URL do arquivo, nunca o conteúdo em si. O editor manda ou uma URL já existente (releitura sem
// mudança, ou um campo omitido numa atualização) ou conteúdo novo (base64/data URL, recém
// importado ou pintado) — aqui é onde a diferença é detectada e o conteúdo novo vira arquivo
public class ArquivosElemento(IArmazenamentoArquivos armazenamento, AppDbContext contexto)
{
    private static bool EhUrlDeArquivo(string valor) =>
        valor.StartsWith(ArmazenamentoLocalArquivos.CaminhoPublico + "/", StringComparison.Ordinal);

    /// <summary>
    /// `novo`: o que veio na requisição (URL existente, base64 novo, ou nulo). `existente`: a URL
    /// já gravada no elemento antes desta requisição, preservada se `novo` vier omitido
    /// </summary>
    public async Task<string?> ResolverModelo3d(string? novo, string? existente)
    {
        if (novo is null) return existente;
        if (EhUrlDeArquivo(novo)) return novo;
        return await armazenamento.SalvarAsync(Convert.FromBase64String(novo), ".glb", ArmazenamentoLocalArquivos.PastaModelos3d);
    }

    /// <summary>Resolve cada valor do dicionário com <see cref="ResolverTexturaUnica"/></summary>
    public async Task<Dictionary<string, string>?> ResolverTexturas(Dictionary<string, string>? texturas, int usuarioId)
    {
        if (texturas is not { Count: > 0 }) return null;

        var resultado = new Dictionary<string, string>();
        foreach (var (face, valor) in texturas)
            resultado[face] = await ResolverTexturaUnica(valor, usuarioId);
        return resultado;
    }

    /// <summary>
    /// Uma cor sólida vai direto (nunca gera arquivo nem entra no catálogo — ver
    /// Formas.EhCorSolida), uma URL de arquivo já existente é mantida, e um data URL
    /// "data:image/jpeg;base64,..." recém pintado/importado vira arquivo agora. Toda imagem (nova
    /// ou já existente) que passa por aqui entra no catálogo de `usuarioId`, se ainda não estiver
    /// lá — é assim que uma textura já usada aparece como opção pronta da próxima vez (ver
    /// TexturasController, tanto pintar uma face quanto importar direto da pasta do servidor)
    /// </summary>
    public async Task<string> ResolverTexturaUnica(string valor, int usuarioId)
    {
        if (Formas.EhCorSolida(valor)) return valor;

        var url = EhUrlDeArquivo(valor)
            ? valor
            : await armazenamento.SalvarAsync(DecodificarDataUrl(valor), ".jpg", ArmazenamentoLocalArquivos.PastaTexturas);
        await CatalogarTextura(url, usuarioId);
        return url;
    }

    private async Task CatalogarTextura(string url, int usuarioId)
    {
        var jaExiste = await contexto.Texturas.AnyAsync(t => t.UsuarioId == usuarioId && t.Url == url);
        if (jaExiste) return;
        contexto.Texturas.Add(new Textura { UsuarioId = usuarioId, Url = url, CriadoEm = DateTime.UtcNow });
        await contexto.SaveChangesAsync();
    }

    /// <summary>
    /// Resolve Modelo3d/Texturas na árvore inteira de um módulo (peça e grupo podem ter filhos)
    /// antes de gravar Modulo.Dados — um módulo nunca referencia elementos de um projeto, então
    /// cada nó sempre traz o conteúdo dele: uma URL já existente (releitura sem mudança) ou base64
    /// novo (import ou peça criada agora)
    /// </summary>
    public async Task<ElementoRequest> ResolverArvore(ElementoRequest elemento, int usuarioId)
    {
        var filhosResolvidos = elemento.Filhos is null
            ? null
            : (await Task.WhenAll(elemento.Filhos.Select(f => ResolverArvore(f, usuarioId)))).ToList();

        return elemento with
        {
            Modelo3d = await ResolverModelo3d(elemento.Modelo3d, null),
            Texturas = await ResolverTexturas(elemento.Texturas, usuarioId),
            Filhos = filhosResolvidos,
        };
    }

    private static byte[] DecodificarDataUrl(string dataUrl)
    {
        var virgula = dataUrl.IndexOf(',');
        var base64 = virgula >= 0 ? dataUrl[(virgula + 1)..] : dataUrl;
        return Convert.FromBase64String(base64);
    }
}
