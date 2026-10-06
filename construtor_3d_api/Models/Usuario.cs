namespace construtor_3d_api.Models;

public class Usuario
{
    public int Id { get; set; }

    public string Nome { get; set; } = string.Empty;

    // Guardado em minúsculas (ver AuthController), pra "Fulano@x.com" e "fulano@x.com" serem a
    // mesma conta; índice único em AppDbContext
    public string Email { get; set; } = string.Empty;

    // Hash do BCrypt (já inclui o sal); a senha em texto puro nunca é gravada
    public string SenhaHash { get; set; } = string.Empty;

    // Acesso total, ignora Permissoes (ver PermissoesServico); não existe tela de seed pro
    // primeiro admin, é setado com um UPDATE manual direto no banco (ver README)
    public bool Admin { get; set; }

    // Chaves de Permissoes.cs liberadas pra esse usuário; irrelevante se Admin for true
    public List<string>? Permissoes { get; set; }

    public DateTime CriadoEm { get; set; } = DateTime.UtcNow;
}
