using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class PisoElemento : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "PisoEspessura",
                table: "Elementos",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PisoVertices",
                table: "Elementos",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PisoEspessura",
                table: "Elementos");

            migrationBuilder.DropColumn(
                name: "PisoVertices",
                table: "Elementos");
        }
    }
}
