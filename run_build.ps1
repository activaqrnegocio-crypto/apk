$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
    Write-Host "Node not found in PATH"
    # Try common locations
    $commonPaths = @(
        "${env:ProgramFiles}\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "$env:USERPROFILE\AppData\Programs\nodejs\node.exe"
    )
    foreach ($p in $commonPaths) {
        if (Test-Path $p) { $nodePath = $p; break }
    }
}

if ($nodePath) {
    Write-Host "Node found at: $nodePath"
    & $nodePath "d:\Abel paginas\Aquatech\crm mayo\aquatech-render-main\build_apk.js"
} else {
    Write-Host "Node not found"
}