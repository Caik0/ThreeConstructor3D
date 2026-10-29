using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaConvencaoEixos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Tudo o que já estava salvo usa a convenção antiga (1); o front converte na leitura
            migrationBuilder.AddColumn<int>(
                name: "ConvencaoEixos",
                table: "Projetos",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.AddColumn<int>(
                name: "ConvencaoEixos",
                table: "Modulos",
                type: "int",
                nullable: false,
                defaultValue: 1);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ConvencaoEixos",
                table: "Projetos");

            migrationBuilder.DropColumn(
                name: "ConvencaoEixos",
                table: "Modulos");
        }
    }
}
