using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    // A partir daqui Z é o eixo vertical (altura) e Y é profundidade — antes era o contrário (ver
    // Controllers/ProjetosController.cs, Models/Formas.cs.ValidarAbertura). Os nomes das colunas
    // não mudam (continuam PosicaoY/PosicaoZ etc., só de propósito: são só "eixo Y"/"eixo Z", igual
    // X — o significado é que muda), então todo elemento já salvo precisa ter os valores de Y e Z
    // trocados entre si pra continuar desenhando no lugar certo. Como a troca é a própria inversa
    // dela mesma, Up e Down fazem exatamente a mesma coisa
    /// <inheritdoc />
    public partial class TrocaEixosYZ : Migration
    {
        private const string Sql = @"
            UPDATE Elementos SET
                PosicaoY = PosicaoZ, PosicaoZ = PosicaoY,
                TamanhoY = TamanhoZ, TamanhoZ = TamanhoY,
                RotacaoY = RotacaoZ, RotacaoZ = RotacaoY;
            UPDATE Projetos SET
                AlturaAmbiente = ProfundidadeAmbiente, ProfundidadeAmbiente = AlturaAmbiente
            WHERE AlturaAmbiente IS NOT NULL OR ProfundidadeAmbiente IS NOT NULL;";

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(Sql);

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql(Sql);
    }
}
