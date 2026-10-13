using System.ComponentModel.DataAnnotations;

namespace construtor_3d_api.Dtos;

public record TexturaResponse(int Id, string Url, DateTime CriadoEm);

// Importa uma imagem direto pro catálogo, sem estar ligada a nenhuma face — usado tanto por quem
// solta um arquivo na pasta do servidor (ver TexturasController.Importar) quanto, no futuro, por
// qualquer outro jeito de trazer uma textura pronta sem passar pelo balde de tinta
public record ImportarTexturaRequest([Required] string? Base64);

// Uma imagem solta na pasta de importação (ver Services/ImportacaoPendente), esperando virar uma
// textura do catálogo sozinha
public record TexturaPendenteResponse(string Nome, string Url);

public record ConcluirTexturaPendenteRequest(
    [Required] string? Nome,
    bool Sucesso);
