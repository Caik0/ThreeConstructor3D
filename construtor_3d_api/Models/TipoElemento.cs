namespace construtor_3d_api.Models;

public enum TipoElemento
{
    Peca,
    Grupo,
    Parede,
    Piso,
    /// <summary>Vão de porta/janela; só existe como filho de uma parede.</summary>
    Abertura,
}
