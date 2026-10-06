namespace construtor_3d_api.Models;

// Peça ou grupo salvo à parte de qualquer projeto, pra poder ser reaproveitado em outros — como um
// componente do SketchUp. `Dados` guarda a árvore inteira (o elemento raiz e os filhos dele) em
// JSON, no mesmo formato (ElementoRequest) usado para salvar/carregar elementos de projeto
public class Modulo
{
    public int Id { get; set; }

    // Mesma regra de Projeto.UsuarioId: nulo nos módulos de antes do login existir
    public int? UsuarioId { get; set; }

    public string Nome { get; set; } = string.Empty;

    // Só peça ou grupo podem ser salvos como módulo; guardado à parte pra listar sem reprocessar o JSON
    public TipoElemento Tipo { get; set; }

    public string Dados { get; set; } = string.Empty;

    public DateTime CriadoEm { get; set; }
}
