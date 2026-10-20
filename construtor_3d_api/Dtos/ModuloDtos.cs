using System.ComponentModel.DataAnnotations;
using construtor_3d_api.Models;

namespace construtor_3d_api.Dtos;

public record CriarModuloRequest(
    [Required, MaxLength(60)] string? Nome,
    // Só peça ou grupo: validado à parte no controller, já que TipoElemento aceita outros valores
    [Required] ElementoRequest? Elemento);

public record RenomearModuloRequest(
    [Required, MaxLength(60)] string? Nome);

public record AtualizarConteudoModuloRequest(
    [Required] ElementoRequest? Elemento);

public record ModuloResponse(
    int Id,
    string Nome,
    TipoElemento Tipo,
    DateTime CriadoEm,
    ElementoRequest Elemento);

// Um .glb solto na pasta de importação (ver Services/ImportacaoPendente), esperando alguém abrir a
// tela de módulos pra ser processado e virar módulo sozinho
public record ModuloPendenteResponse(string Nome, string Url);

public record ConcluirPendenteRequest(
    [Required] string? Nome,
    bool Sucesso);

// Envia o .glb original inteiro (sem separar nada) uma vez só; toda peça encontrada nele aponta
// pra essa mesma URL depois, cada uma com o caminho (Modelo3dNo) da própria malha
public record EnviarModelo3dRequest(
    [Required] string? Base64);

public record EnviarModelo3dResponse(string Url);
