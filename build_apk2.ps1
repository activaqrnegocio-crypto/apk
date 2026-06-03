$androidDir = "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\android"
$gradlewBat = Join-Path $androidDir "gradlew.bat"
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = $gradlewBat
$psi.WorkingDirectory = $androidDir
$psi.Arguments = "-p `"$androidDir`" assembleDebug"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$proc = [System.Diagnostics.Process]::Start($psi)
$proc.WaitForExit()
Write-Host "Exit code:" $proc.ExitCode