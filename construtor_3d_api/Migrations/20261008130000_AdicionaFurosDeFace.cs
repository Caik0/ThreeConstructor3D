using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace construtor_3d_api.Migrations
{
    /// <inheritdoc />
    public partial class AdicionaFurosDeFace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Furos",
                table: "Elementos",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Furos",
                table: "Elementos");
        }
    }
}
