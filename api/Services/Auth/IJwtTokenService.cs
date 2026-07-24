using api.Models;

namespace api.Services.Auth;

public interface IJwtTokenService
{
    string GenerateToken(User user);
}
