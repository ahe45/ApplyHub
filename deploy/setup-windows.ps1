$ErrorActionPreference = 'Stop'
$rootDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$envPath = Join-Path $rootDir '.env'
$setupLog = Join-Path $rootDir 'log\setup-windows.log'
$transcriptStarted = $false
$previousConsoleEncoding = [Console]::OutputEncoding

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message"
}

function Refresh-NodePath {
    $nodeDir = Join-Path $env:ProgramFiles 'nodejs'
    if (Test-Path (Join-Path $nodeDir 'node.exe')) {
        $env:Path = "$nodeDir;$env:Path"
    }
}

function Test-NodeReady {
    if (-not (Get-Command node.exe -ErrorAction SilentlyContinue)) { return $false }
    if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { return $false }
    $nodeVersion = & node.exe --version
    if ($LASTEXITCODE -ne 0) { return $false }
    return ([version]($nodeVersion.TrimStart('v')) -ge [version]'22.13.0')
}

function Invoke-Checked([string]$file, [string[]]$commandArgs) {
    Write-Host "> $file $($commandArgs -join ' ')"
    & $file @commandArgs
    if ($LASTEXITCODE -ne 0) { throw "$file failed with exit code $LASTEXITCODE." }
}

function Read-Default([string]$label, [string]$currentValue) {
    $answer = Read-Host "$label [$currentValue]"
    if ([string]::IsNullOrWhiteSpace($answer)) { return $currentValue }
    return $answer.Trim()
}

function Read-Port([string]$label, [string]$currentValue) {
    while ($true) {
        $answer = Read-Default $label $currentValue
        $portNumber = 0
        if ([int]::TryParse($answer, [ref]$portNumber) -and $portNumber -ge 1 -and $portNumber -le 65535) {
            return [string]$portNumber
        }
        Write-Warning 'Enter a port between 1 and 65535.'
    }
}

function Read-Password([string]$currentValue) {
    $hint = if ($currentValue) { 'Enter keeps the existing password' } else { 'required' }
    while ($true) {
        $secureValue = Read-Host "Q3. DB USER PASSWORD ($hint)" -AsSecureString
        if ($secureValue.Length -eq 0) {
            if ($currentValue) { return $currentValue }
            Write-Warning 'Enter the DB password.'
            continue
        }
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    }
}

Push-Location $rootDir
try {
    [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
    New-Item -ItemType Directory -Path (Join-Path $rootDir 'log') -Force | Out-Null
    Start-Transcript -Path $setupLog -Append | Out-Null
    $transcriptStarted = $true

    Write-Step 'Checking Node.js and npm'
    Refresh-NodePath
    if (-not (Test-NodeReady)) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            throw 'Install Node.js 24, then run start-server.bat again. Automatic installation requires winget (App Installer).'
        }
        Write-Host 'Installing a supported Node.js version with winget. Windows may ask for administrator permission.'
        Invoke-Checked 'winget.exe' @('install', '--exact', '--id', 'OpenJS.NodeJS.LTS', '--accept-package-agreements', '--accept-source-agreements')
        Refresh-NodePath
        if (-not (Test-NodeReady)) {
            throw 'Node.js 22.13 or newer and npm are required. Close this window and run start-server.bat again after installing Node.js.'
        }
    }
    Invoke-Checked 'node.exe' @('--version')

    Write-Step 'Installing project dependencies'
    Invoke-Checked 'npm.cmd' @('ci')

    Write-Step 'Configuring ApplyHub'
    Write-Host 'MySQL or MariaDB must already be installed and running.'
    Write-Host 'Use a DB account with permission to create and update the configured database.'
    Write-Host 'Default server port: 3000. Database: applyhub at 127.0.0.1:3306.'
    Write-Host 'Existing email and other settings are preserved.'
    if (-not (Test-Path -LiteralPath $envPath)) {
        Copy-Item -LiteralPath (Join-Path $rootDir '.env.example') -Destination $envPath
    }

    # Capture JSON without displaying the existing database password in the transcript.
    $currentJson = & node.exe scripts/windows-env.js read
    if ($LASTEXITCODE -ne 0) { throw 'Could not read .env.' }
    $current = $currentJson | ConvertFrom-Json
    $portDefault = if ($current.PORT) { $current.PORT } else { '3000' }
    $useCustomPort = Read-Host 'Q1. Set a custom server port? (Y/N, default: N)'
    $serverPort = '3000'
    if ($useCustomPort.Trim().ToLowerInvariant() -eq 'y') {
        $serverPort = Read-Port 'Q1-1. Server port' $portDefault
    }
    do {
        $dbUser = Read-Default 'Q2. DB USER ID' $current.DB_USER
        if (-not $dbUser) { Write-Warning 'Enter the DB user ID.' }
    } while (-not $dbUser)
    $settings = [ordered]@{
        PORT = $serverPort
        DB_HOST = '127.0.0.1'
        DB_PORT = '3306'
        DB_NAME = 'applyhub'
        DB_USER = $dbUser
        DB_PASSWORD = Read-Password $current.DB_PASSWORD
    }
    # Base64 keeps Unicode intact in PowerShell 5.1's native stdin pipeline.
    # The payload goes through stdin, never command arguments or the log.
    $settingsJson = $settings | ConvertTo-Json -Compress
    $payload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($settingsJson))
    $payload | & node.exe scripts/windows-env.js write
    if ($LASTEXITCODE -ne 0) { throw 'Could not save .env.' }

    Write-Step 'Preparing database schema'
    Invoke-Checked 'npm.cmd' @('run', 'db:setup')
    Invoke-Checked 'node.exe' @('scripts/check-startup.js')

    Write-Step 'Checking PDF browser'
    $edgePaths = @(
        (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
    )
    if (-not ($edgePaths | Where-Object { Test-Path -LiteralPath $_ })) {
        Write-Warning 'Microsoft Edge was not found in its standard installation folders. Install it to generate admission ticket PDFs.'
    }

    Write-Step 'Setup complete'
    Write-Host "Local URL: http://localhost:$($settings.PORT)"
    Write-Host "Same-network URL: http://<server-ip>:$($settings.PORT)"
    Write-Host 'Returning to start-server.bat to start ApplyHub.'
} catch {
    Write-Host ""
    Write-Host 'ApplyHub setup failed.' -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host 'Check the DB service and settings, then run start-server.bat --setup again.'
    exit 1
} finally {
    if ($transcriptStarted) { Stop-Transcript | Out-Null }
    [Console]::OutputEncoding = $previousConsoleEncoding
    Pop-Location
}
