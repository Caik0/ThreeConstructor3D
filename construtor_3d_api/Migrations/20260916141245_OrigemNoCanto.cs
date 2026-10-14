using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class OrigemNoCanto : Migration
    {
        // Duas mudanças para ficar igual ao SketchUp, mantendo tudo no mesmo lugar da cena:
        // 1. A origem das peças deixa de ser o centro da base e passa a ser o canto frontal inferior
        //    esquerdo: X recua metade da largura (diâmetro no cilindro)
        // 2. Profundidade (Z) positiva passa a apontar para trás, e não para a frente: o Z de todos
        //    os elementos muda de sinal; nas peças, a origem vai para a face da frente (+ metade da profundidade)

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE Elementos
                SET PosicaoX = PosicaoX - CASE TipoForma
                        WHEN N'Cilindro' THEN CAST(JSON_VALUE(ParametrosForma, '$.diametro') AS float)
                        ELSE CAST(JSON_VALUE(ParametrosForma, '$.largura') AS float)
                    END / 2,
                    PosicaoZ = -(PosicaoZ + CASE TipoForma
                        WHEN N'Cilindro' THEN CAST(JSON_VALUE(ParametrosForma, '$.diametro') AS float)
                        ELSE CAST(JSON_VALUE(ParametrosForma, '$.profundidade') AS float)
                    END / 2)
                WHERE Tipo = N'Peca';

                UPDATE Elementos SET PosicaoZ = -PosicaoZ WHERE Tipo = N'Grupo';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                UPDATE Elementos
                SET PosicaoX = PosicaoX + CASE TipoForma
                        WHEN N'Cilindro' THEN CAST(JSON_VALUE(ParametrosForma, '$.diametro') AS float)
                        ELSE CAST(JSON_VALUE(ParametrosForma, '$.largura') AS float)
                    END / 2,
                    PosicaoZ = -PosicaoZ - CASE TipoForma
                        WHEN N'Cilindro' THEN CAST(JSON_VALUE(ParametrosForma, '$.diametro') AS float)
                        ELSE CAST(JSON_VALUE(ParametrosForma, '$.profundidade') AS float)
                    END / 2
                WHERE Tipo = N'Peca';

                UPDATE Elementos SET PosicaoZ = -PosicaoZ WHERE Tipo = N'Grupo';
                """);
        }
    }
}
