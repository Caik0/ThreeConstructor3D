using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class PecasDoProjeto : Migration
    {
        // Ordem ajustada à mão: a forma de cada projeto é copiada para a tabela Pecas
        // antes de as colunas antigas serem removidas

        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "AtualizadoEm",
                table: "Projetos",
                type: "datetime2",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.Sql("UPDATE Projetos SET AtualizadoEm = CriadoEm;");

            migrationBuilder.CreateTable(
                name: "Pecas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ProjetoId = table.Column<int>(type: "int", nullable: false),
                    Nome = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: false),
                    TipoForma = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ParametrosForma = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    PosicaoX = table.Column<double>(type: "float", nullable: false),
                    PosicaoY = table.Column<double>(type: "float", nullable: false),
                    PosicaoZ = table.Column<double>(type: "float", nullable: false),
                    Ordem = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pecas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pecas_Projetos_ProjetoId",
                        column: x => x.ProjetoId,
                        principalTable: "Projetos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Pecas_ProjetoId",
                table: "Pecas",
                column: "ProjetoId");

            // A forma de cada projeto existente vira a primeira peça, na origem
            migrationBuilder.Sql(
                """
                INSERT INTO Pecas (ProjetoId, Nome, TipoForma, ParametrosForma, PosicaoX, PosicaoY, PosicaoZ, Ordem)
                SELECT Id, TipoForma + N' 1', TipoForma, ParametrosForma, 0, 0, 0, 0
                FROM Projetos;
                """);

            migrationBuilder.DropColumn(
                name: "ParametrosForma",
                table: "Projetos");

            migrationBuilder.DropColumn(
                name: "TipoForma",
                table: "Projetos");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ParametrosForma",
                table: "Projetos",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "TipoForma",
                table: "Projetos",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            // Volta a guardar no projeto a forma da primeira peça (projetos sem peças ficam vazios)
            migrationBuilder.Sql(
                """
                UPDATE p
                SET TipoForma = primeira.TipoForma, ParametrosForma = primeira.ParametrosForma
                FROM Projetos p
                CROSS APPLY (
                    SELECT TOP 1 TipoForma, ParametrosForma
                    FROM Pecas
                    WHERE ProjetoId = p.Id
                    ORDER BY Ordem, Id
                ) primeira;
                """);

            migrationBuilder.DropTable(
                name: "Pecas");

            migrationBuilder.DropColumn(
                name: "AtualizadoEm",
                table: "Projetos");
        }
    }
}
