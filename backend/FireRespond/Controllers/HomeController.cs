using System.Diagnostics;
using FireRespond.Models;
using Microsoft.AspNetCore.Mvc;

namespace FireRespond.Controllers;

public class HomeController : Controller
{
    // Dashboard BPBD. Cek login dilakukan di sisi browser (token dari /api/auth/login).
    public IActionResult Index() => View();

    public IActionResult Login() => View();

    public IActionResult Privacy() => View();

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
        => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
}
