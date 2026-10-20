using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class PlantaDoAmbiente : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "AlturaAmbiente",
                table: "Projetos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "LarguraAmbiente",
                table: "Projetos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "ProfundidadeAmbiente",
                table: "Projetos",
                type: "float",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AlturaAmbiente",
                table: "Projetos");

            migrationBuilder.DropColumn(
                name: "LarguraAmbiente",
                table: "Projetos");

            migrationBuilder.DropColumn(
                name: "ProfundidadeAmbiente",
                table: "Projetos");
        }
    }
}
