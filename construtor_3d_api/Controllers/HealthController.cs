using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using construtor_3d_api.Data;

namespace construtor_3d_api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _context;

    public HealthController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var database = await _context.Database.CanConnectAsync();

        return Ok(new
        {
            api = "online",
            database
        });
    }
}