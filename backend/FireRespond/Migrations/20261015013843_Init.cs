using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace FireRespond.Migrations
{
    /// <inheritdoc />
    public partial class Init : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Desa",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nama = table.Column<string>(type: "text", nullable: false),
                    Lat = table.Column<double>(type: "double precision", nullable: false),
                    Lon = table.Column<double>(type: "double precision", nullable: false),
                    RadiusKm = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Desa", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TitikPanas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Lat = table.Column<double>(type: "double precision", nullable: false),
                    Lon = table.Column<double>(type: "double precision", nullable: false),
                    WaktuDeteksiUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    Confidence = table.Column<string>(type: "text", nullable: false),
                    Satelit = table.Column<string>(type: "text", nullable: false),
                    Frp = table.Column<double>(type: "double precision", nullable: false),
                    DariReplay = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TitikPanas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Regu",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Nama = table.Column<string>(type: "text", nullable: false),
                    DesaId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Regu", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Regu_Desa_DesaId",
                        column: x => x.DesaId,
                        principalTable: "Desa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Pengguna",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Username = table.Column<string>(type: "text", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: false),
                    NamaLengkap = table.Column<string>(type: "text", nullable: false),
                    Role = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    ReguId = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Pengguna", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Pengguna_Regu_ReguId",
                        column: x => x.ReguId,
                        principalTable: "Regu",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Tiket",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TitikPanasId = table.Column<int>(type: "integer", nullable: false),
                    DesaId = table.Column<int>(type: "integer", nullable: false),
                    ReguId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    JarakKm = table.Column<double>(type: "double precision", nullable: false),
                    Dieskalasi = table.Column<bool>(type: "boolean", nullable: false),
                    EskalasiOtomatis = table.Column<bool>(type: "boolean", nullable: false),
                    BantuanDikirim = table.Column<bool>(type: "boolean", nullable: false),
                    JumlahDibukaUlang = table.Column<int>(type: "integer", nullable: false),
                    DibuatUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DireponsUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    TibaUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    EskalasiUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PadamUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    SelesaiUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    LuasTerbakarHa = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tiket", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Tiket_Desa_DesaId",
                        column: x => x.DesaId,
                        principalTable: "Desa",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tiket_Regu_ReguId",
                        column: x => x.ReguId,
                        principalTable: "Regu",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_Tiket_TitikPanas_TitikPanasId",
                        column: x => x.TitikPanasId,
                        principalTable: "TitikPanas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UpdateTiket",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    TiketId = table.Column<int>(type: "integer", nullable: false),
                    PenggunaId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    FotoPath = table.Column<string>(type: "text", nullable: true),
                    Lat = table.Column<double>(type: "double precision", nullable: true),
                    Lon = table.Column<double>(type: "double precision", nullable: true),
                    LuasHa = table.Column<double>(type: "double precision", nullable: true),
                    UkuranApi = table.Column<string>(type: "text", nullable: true),
                    ArahSebaran = table.Column<string>(type: "text", nullable: true),
                    Catatan = table.Column<string>(type: "text", nullable: true),
                    WaktuUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UpdateTiket", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UpdateTiket_Pengguna_PenggunaId",
                        column: x => x.PenggunaId,
                        principalTable: "Pengguna",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_UpdateTiket_Tiket_TiketId",
                        column: x => x.TiketId,
                        principalTable: "Tiket",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Pengguna_ReguId",
                table: "Pengguna",
                column: "ReguId");

            migrationBuilder.CreateIndex(
                name: "IX_Pengguna_Username",
                table: "Pengguna",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Regu_DesaId",
                table: "Regu",
                column: "DesaId");

            migrationBuilder.CreateIndex(
                name: "IX_Tiket_DesaId",
                table: "Tiket",
                column: "DesaId");

            migrationBuilder.CreateIndex(
                name: "IX_Tiket_ReguId",
                table: "Tiket",
                column: "ReguId");

            migrationBuilder.CreateIndex(
                name: "IX_Tiket_Status",
                table: "Tiket",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Tiket_TitikPanasId",
                table: "Tiket",
                column: "TitikPanasId");

            migrationBuilder.CreateIndex(
                name: "IX_TitikPanas_Lat_Lon_WaktuDeteksiUtc",
                table: "TitikPanas",
                columns: new[] { "Lat", "Lon", "WaktuDeteksiUtc" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UpdateTiket_PenggunaId",
                table: "UpdateTiket",
                column: "PenggunaId");

            migrationBuilder.CreateIndex(
                name: "IX_UpdateTiket_TiketId",
                table: "UpdateTiket",
                column: "TiketId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "UpdateTiket");

            migrationBuilder.DropTable(
                name: "Pengguna");

            migrationBuilder.DropTable(
                name: "Tiket");

            migrationBuilder.DropTable(
                name: "Regu");

            migrationBuilder.DropTable(
                name: "TitikPanas");

            migrationBuilder.DropTable(
                name: "Desa");
        }
    }
}
