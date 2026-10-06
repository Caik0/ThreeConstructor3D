namespace construtor_3d_api.Dtos;

public record AtualizarPermissoesRequest(bool Admin, List<string>? Permissoes);
