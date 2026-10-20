using Microsoft.AspNetCore.Mvc.ModelBinding;
using construtor_3d_api.Dtos;

namespace construtor_3d_api.Models;

// Validação da árvore de elementos recebida da API, compartilhada entre o salvamento de um
// projeto inteiro (ProjetosController) e o salvamento de um módulo avulso (ModulosController)
public static class ArvoreElementos
{
    // Valida a árvore recebida e devolve o total de elementos
    public static int Validar(
        List<ElementoRequest> elementos,
        string caminho,
        int profundidade,
        Dictionary<int, Elemento> existentes,
        HashSet<int> idsMantidos,
        ModelStateDictionary modelState)
    {
        var total = elementos.Count;

        if (profundidade > Formas.ProfundidadeMaxima)
        {
            modelState.AddModelError(caminho, $"A estrutura pode ter no máximo {Formas.ProfundidadeMaxima} níveis.");
            return total;
        }

        for (var i = 0; i < elementos.Count; i++)
        {
            var dados = elementos[i];
            var campo = $"{caminho}[{i}]";

            if (dados.Id is int elementoId && (!existentes.ContainsKey(elementoId) || !idsMantidos.Add(elementoId)))
                modelState.AddModelError($"{campo}.id", $"Elemento {elementoId} não pertence a este projeto ou está repetido.");

            if (Formas.ValidarFormulas(dados.Formulas, dados.VariaveisFormulas, dados.VariaveisPorFaceFormulas) is string erroFormulas)
                modelState.AddModelError($"{campo}.formulas", $"{dados.Nome}: {erroFormulas}");

            if (dados.Travados is { Count: > Formas.TravadosPorElementoMaximo } ||
                dados.Travados is not null && dados.Travados.Any(t => t.Length > Formas.NomeVariavelComprimentoMaximo))
                modelState.AddModelError($"{campo}.travados", $"{dados.Nome}: travas inválidas.");

            if (Formas.ValidarTexturas(dados.Texturas) is string erroTexturas)
                modelState.AddModelError($"{campo}.texturas", $"{dados.Nome}: {erroTexturas}");

            if (Formas.ValidarGruposDeFace(dados.GruposDeFace) is string erroGrupos)
                modelState.AddModelError($"{campo}.gruposDeFace", $"{dados.Nome}: {erroGrupos}");

            if (dados.IdUnico is { Length: > Formas.IdModuloComprimentoMaximo } ||
                dados.IdSequencial is { Length: > Formas.IdModuloComprimentoMaximo })
                modelState.AddModelError($"{campo}.idUnico", $"{dados.Nome}: etiqueta grande demais.");

            if (dados.ReferenciaEstavel is { Length: > Formas.IdModuloComprimentoMaximo })
                modelState.AddModelError($"{campo}.referenciaEstavel", $"{dados.Nome}: referência interna grande demais.");

            if (dados.VerticesParede is { Count: > Formas.VerticesParedeMaximo })
                modelState.AddModelError($"{campo}.verticesParede", $"{dados.Nome}: no máximo {Formas.VerticesParedeMaximo} cantos.");

            if (dados.Piso?.Vertices is { Count: > Formas.VerticesPisoMaximo })
                modelState.AddModelError($"{campo}.piso.vertices", $"{dados.Nome}: no máximo {Formas.VerticesPisoMaximo} cantos.");

            if (dados.Tipo == TipoElemento.Peca)
            {
                // Modelo3d (e o Tamanho da malha) só vêm na criação; numa peça já existente, o
                // editor não reenvia os bytes de volta a cada salvamento (ver AplicarArvore), então
                // Forma/Modelo3d/Tamanho ausentes numa atualização são válidos: o que já tinha
                // gravado continua valendo
                var existente = dados.Id is int idExistente ? existentes.GetValueOrDefault(idExistente) : null;
                var mantendoModelo3dExistente = existente?.Modelo3dUrl is not null && dados.Forma is null && dados.Modelo3d is null;

                if (dados.Forma is not null && dados.Modelo3d is not null)
                    modelState.AddModelError($"{campo}.forma", $"{dados.Nome}: uma peça não pode ter forma e modelo 3D ao mesmo tempo.");
                else if (dados.Modelo3d is not null)
                {
                    if (Formas.ValidarModelo3d(dados.Modelo3d) is string erroModelo)
                        modelState.AddModelError($"{campo}.modelo3d", $"{dados.Nome}: {erroModelo}");
                    if (dados.Tamanho is null)
                        modelState.AddModelError($"{campo}.tamanho", $"{dados.Nome}: peça de modelo 3D precisa do tamanho da malha.");
                }
                else if (mantendoModelo3dExistente)
                {
                    // Nada a validar: Forma/Modelo3d/Tamanho continuam os já gravados
                }
                else if (dados.Forma is null)
                    modelState.AddModelError($"{campo}.forma", $"{dados.Nome}: peças precisam de uma forma ou de um modelo 3D.");
                else if (Formas.Validar(dados.Forma.Tipo!.Value, dados.Forma.Parametros!) is string erroForma)
                    modelState.AddModelError($"{campo}.forma.parametros", $"{dados.Nome}: {erroForma}");

                // Uma peça pode conter outros elementos (como um grupo), menos um vão solto — só
                // faz sentido dentro de uma parede
                if (dados.Filhos is { Count: > 0 } filhosDaPeca)
                {
                    var vaoSolto = filhosDaPeca.FirstOrDefault(f => f.Tipo == TipoElemento.Abertura);
                    if (vaoSolto is not null)
                        modelState.AddModelError($"{campo}.filhos", $"{dados.Nome}: um vão só pode estar dentro de uma parede.");

                    total += Validar(filhosDaPeca, $"{campo}.filhos", profundidade + 1, existentes, idsMantidos, modelState);
                }
            }
            else if (dados.Tipo == TipoElemento.Parede)
            {
                if (dados.Parede is null)
                    modelState.AddModelError($"{campo}.parede", $"{dados.Nome}: paredes precisam de comprimento, altura e espessura.");

                // Filhos de uma parede só podem ser vãos, e cada um precisa caber nela — checado
                // aqui (não em Validar) porque só aqui temos a medida da parede-mãe à mão
                if (dados.Filhos is { Count: > 0 } vaos)
                {
                    if (vaos.Count > Formas.AberturasPorParedeMaximo)
                        modelState.AddModelError($"{campo}.filhos", $"{dados.Nome}: no máximo {Formas.AberturasPorParedeMaximo} vãos por parede.");

                    for (var j = 0; j < vaos.Count; j++)
                    {
                        var vao = vaos[j];
                        if (vao.Tipo != TipoElemento.Abertura)
                            modelState.AddModelError($"{campo}.filhos[{j}].tipo", $"{vao.Nome}: uma parede só pode conter vãos.");
                        else if (dados.Parede is not null && vao.Abertura is not null && vao.Posicao is not null &&
                                 Formas.ValidarAbertura(vao.Abertura, vao.Posicao, dados.Parede) is string erroAbertura)
                            modelState.AddModelError($"{campo}.filhos[{j}].abertura", $"{vao.Nome}: {erroAbertura}");
                    }

                    total += Validar(vaos, $"{campo}.filhos", profundidade + 1, existentes, idsMantidos, modelState);
                }
            }
            else if (dados.Tipo == TipoElemento.Piso)
            {
                if (dados.Piso?.Vertices is not { Count: >= 3 })
                    modelState.AddModelError($"{campo}.piso", $"{dados.Nome}: pisos precisam de um polígono com pelo menos 3 cantos.");

                if (dados.Filhos is { Count: > 0 })
                    modelState.AddModelError($"{campo}.filhos", $"{dados.Nome}: pisos não podem conter outros elementos.");
            }
            else if (dados.Tipo == TipoElemento.Abertura)
            {
                if (dados.Abertura is null)
                    modelState.AddModelError($"{campo}.abertura", $"{dados.Nome}: vãos precisam de tipo, largura e altura.");

                if (dados.Filhos is { Count: > 0 })
                    modelState.AddModelError($"{campo}.filhos", $"{dados.Nome}: vãos não podem conter outros elementos.");
            }
            else if (dados.Filhos is not null)
            {
                total += Validar(dados.Filhos, $"{campo}.filhos", profundidade + 1, existentes, idsMantidos, modelState);
            }
        }

        return total;
    }
}
