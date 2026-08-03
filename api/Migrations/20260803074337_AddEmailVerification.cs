using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace api.Migrations
{
    /// <inheritdoc />
    public partial class AddEmailVerification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Email NULLABLE olarak ekleniyor - aşağıda var olan (bu özellikten
            // önce oluşmuş, e-postasız) kullanıcılara benzersiz bir placeholder
            // değer yazılıp NOT NULL'a çevrilecek. Aksi halde tüm eski satırlar
            // ayynı boş string'i alır ve az sonraki UNIQUE INDEX çakışmadan
            // patlardı (bkz. atlas-platform'daki "yetim veri" dersi - var olan
            // veriyle migration'ı test etmeden NOT NULL/UNIQUE eklenmez).
            migrationBuilder.AddColumn<string>(
                name: "Email",
                table: "Users",
                type: "nvarchar(450)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EmailVerificationAttempts",
                table: "Users",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "EmailVerificationCodeExpiresAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EmailVerificationCodeHash",
                table: "Users",
                type: "nvarchar(max)",
                nullable: true);

            // Var olan kullanıcılar bu özellikten ÖNCE, e-posta doğrulaması hiç
            // yokken oluşturuldu - IsEmailVerified varsayılan olarak false
            // gelirse hepsi aniden giriş yapamaz hale gelirdi. Bu yüzden
            // varsayılan true, sadece BUNDAN SONRA kayıt olacaklar (Program.cs'in
            // register uç noktası User.IsEmailVerified'ı elle false set ediyor)
            // false ile başlayacak.
            migrationBuilder.AddColumn<bool>(
                name: "IsEmailVerified",
                table: "Users",
                type: "bit",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastVerificationCodeSentAt",
                table: "Users",
                type: "datetime2",
                nullable: true);

            // Var olan (e-postasız) kullanıcılara benzersiz bir placeholder
            // e-posta - gerçek bir adres değil, sadece UNIQUE INDEX'in
            // patlamaması için. Bu kullanıcılar zaten yukarıda IsEmailVerified=1
            // ile giriş yapabilir durumda, bu placeholder'ı hiç görmeyecekler.
            migrationBuilder.Sql(
                "UPDATE Users SET Email = LOWER(Username) + '@placeholder.local' WHERE Email IS NULL;");

            migrationBuilder.AlterColumn<string>(
                name: "Email",
                table: "Users",
                type: "nvarchar(450)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(450)",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Users_Email",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "Email",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "EmailVerificationAttempts",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "EmailVerificationCodeExpiresAt",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "EmailVerificationCodeHash",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "IsEmailVerified",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "LastVerificationCodeSentAt",
                table: "Users");
        }
    }
}
