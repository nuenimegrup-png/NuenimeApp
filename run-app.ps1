# ==============================================================================
# Nuenime App - PowerShell Launcher Script
# Menjalankan Web & Expo Dev Server (Port 8081) + Backend API Server (Port 3000)
# ==============================================================================

param (
    [int]$Port = 8081,
    [switch]$NoBrowser,
    [switch]$ClearCache
)

$ErrorActionPreference = "Stop"

# Set encoding & working directory ke root project
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "                NUENIME APP - LAUNCHER                    " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Cek keberadaan runtime (Bun / Node)
$runtime = "bun"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $runtime = "npm"
        Write-Host "[INFO] Bun tidak ditemukan, menggunakan npm." -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] Node.js / Bun belum terpasang di sistem!" -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "[OK] Runtime terdeteksi: Bun ($(bun --version))" -ForegroundColor Green
}

# 2. Cek apakah port 8081 atau 3000 sedang terkunci oleh proses lama
function Free-Port([int]$TargetPort) {
    $conns = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($conn in $conns) {
            $pidToKill = $conn.OwningProcess
            if ($pidToKill -and $pidToKill -ne $PID -and $pidToKill -ne 0 -and $pidToKill -ne 4) {
                Write-Host "[INFO] Port $TargetPort sedang digunakan oleh PID $pidToKill. Menghentikan proses lama..." -ForegroundColor Yellow
                try {
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Milliseconds 500
                } catch {}
            }
        }
    }
}

Free-Port -TargetPort $Port
Free-Port -TargetPort 3000

# 3. Opsi bersihkan cache jika diminta
if ($ClearCache) {
    Write-Host "[INFO] Membersihkan Metro & Expo Cache..." -ForegroundColor Cyan
    Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
}

# 4. Ambil IP Local untuk kemudahan koneksi HP / APK
$localIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
    $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notlike "*Loopback*"
} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  Web App (Browser) : " -NoNewline; Write-Host "http://localhost:$Port" -ForegroundColor Green
if ($localIP) {
Write-Host "  Koneksi HP / APK  : " -NoNewline; Write-Host "http://${localIP}:$Port" -ForegroundColor Cyan
}
Write-Host "  Backend Server    : " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "[INFO] Menjalankan server Nuenime..." -ForegroundColor Magenta
Write-Host "       Tekan Ctrl + C di terminal ini untuk berhenti." -ForegroundColor DarkGray
Write-Host ""

# 5. Buka browser otomatis setelah delay singkat jika tidak dicegah
if (-not $NoBrowser) {
    Start-Job -ScriptBlock {
        param($targetUrl, $targetPort)
        $ready = $false
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            try {
                $res = Invoke-WebRequest -Uri "http://localhost:$targetPort/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($res -and $res.StatusCode -eq 200) {
                    $ready = $true
                    break
                }
            } catch {}
        }
        Start-Process $targetUrl
    } -ArgumentList "http://localhost:$Port", $Port | Out-Null
}

# 6. Jalankan server dev utama
if ($runtime -eq "bun") {
    bun run dev
} else {
    npm run dev
}
