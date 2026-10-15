using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaModelo3d : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<byte[]>(
                name: "Modelo3d",
                table: "Elementos",
                type: "varbinary(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Modelo3d",
                table: "Elementos");
        }
    }
}
