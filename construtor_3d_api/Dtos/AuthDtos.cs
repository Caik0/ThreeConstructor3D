using System.ComponentModel.DataAnnotations;
using construtor_3d_api.Models;

namespace construtor_3d_api.Dtos;

public record CadastroRequest(
    [Required, StringLength(LimitesUsuario.NomeComprimentoMaximo, MinimumLength = LimitesUsuario.NomeComprimentoMinimo)]
    string Nome,
    [Required, EmailAddress, StringLength(LimitesUsuario.EmailComprimentoMaximo)]
    string Email,
    [Required, StringLength(LimitesUsuario.SenhaComprimentoMaximo, MinimumLength = LimitesUsuario.SenhaComprimentoMinimo)]
    string Senha);

public record LoginRequest(
    [Required] string Email,
    [Required] string Senha);

public record UsuarioResponse(int Id, string Nome, string Email, bool Admin, List<string>? Permissoes, DateTime CriadoEm);

public record AutenticacaoResponse(string Token, UsuarioResponse Usuario);
