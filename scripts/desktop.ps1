param(
    [ValidateSet('dev', 'build', 'check', 'test')][string]$Action = 'dev',
    [switch]$DebugBuild
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
$localCargo = Join-Path $PWD '.tools/cargo/bin'
$localLlvm = Join-Path $PWD '.tools/llvm-mingw-20261020-ucrt-x86_64/bin'
$extraConfig = @()
if (-not (Get-Command cargo -ErrorAction SilentlyContinue) -and (Test-Path (Join-Path $localCargo 'cargo.exe'))) {
    $env:CARGO_HOME = Join-Path $PWD '.tools/cargo'
    $env:RUSTUP_HOME = Join-Path $PWD '.tools/rustup'
    $env:RUSTUP_TOOLCHAIN = 'stable-x86_64-pc-windows-gnullvm'
    $env:PATH = "$localCargo;$localLlvm;$env:PATH"
    $runtime = Join-Path $PWD '.tools/llvm-mingw-20261020-ucrt-x86_64/x86_64-w64-mingw32/bin/libunwind.dll'
    if ((Test-Path $runtime) -and $Action -in @('dev', 'build')) {
        $resources = @{}; $resources[$runtime] = 'libunwind.dll'
        $loader = Get-ChildItem -Path "$env:CARGO_HOME/registry/src/*/webview2-com-sys-*/x64/WebView2Loader.dll" | Select-Object -First 1
        if (-not $loader) { throw 'Run the desktop check once to fetch WebView2 dependencies before packaging the local LLVM build.' }
        $resources[$loader.FullName] = 'WebView2Loader.dll'
        @{ bundle = @{ resources = $resources } } | ConvertTo-Json -Depth 4 | Set-Content '.tools/tauri-runtime.json'
        $extraConfig = @('--config', '.tools/tauri-runtime.json')
        $profile = if ($Action -eq 'dev' -or $DebugBuild) { 'debug' } else { 'release' }
        $destination = Join-Path $PWD "src-tauri/target/$profile"
        New-Item -ItemType Directory -Force $destination | Out-Null
        # A build script can load an existing DLL here and prevent Tauri replacing it.
        $runtimeDestination = Join-Path $destination 'libunwind.dll'
        if (Test-Path -LiteralPath $runtimeDestination) { Remove-Item -LiteralPath $runtimeDestination }
    }
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Install Rust stable and Visual Studio C++ Build Tools. See README.md.' }
switch ($Action) {
    'dev' { & npm exec tauri -- dev @extraConfig }
    'build' { $flags = if ($DebugBuild) { @('--debug') } else { @() }; & npm exec tauri -- build @flags @extraConfig }
    'check' { & cargo check --manifest-path src-tauri/Cargo.toml }
    'test' { & cargo test --manifest-path src-tauri/Cargo.toml --no-default-features }
}
exit $LASTEXITCODE
