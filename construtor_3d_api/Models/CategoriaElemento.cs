namespace construtor_3d_api.Models;

/// <summary>
/// Papel de uma peça ou grupo dentro do módulo. Permite filtrar e substituir só as ferragens ou
/// só as furações sem mexer na estrutura (chapas, tampos etc.).
/// </summary>
public enum CategoriaElemento
{
    Estrutura,
    Ferragem,
    Furacao,
}
