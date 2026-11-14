# ==============================================================================
# Nuenime App - Multi-Service PowerShell Launcher
# Pilihan:
# 1. Run Project (Nuenime App Utama + Backend API - Port 8081 & 3000)
# 2. Run Dunia-Nuenime (RPG World - Port 3001)
# 3. Run NuePet Zoo (3D Pet Sanctuary - Port 3002)
# 4. Run Semua Sekaligus (Project + Dunia + NuePet)
# ==============================================================================

param (
    [switch]$Project,
    [switch]$Dunia,
    [switch]$Nuepet,
    [switch]$All,
    [switch]$NoBrowser,
    [switch]$ClearCache
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Set lokasi ke direktori root Nuenime-App
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }
Set-Location -Path $rootDir

# ─── 1. Cek Keberadaan Runtime Bun / Node ───
$runtime = "bun"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $runtime = "npm"
    } else {
        Write-Host "[ERROR] Node.js / Bun belum terpasang di sistem!" -ForegroundColor Red
        Exit 1
    }
}

# ─── 2. Ambil IP Local untuk kemudahan koneksi HP / APK ───
$localIP = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { 
    $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" -and $_.InterfaceAlias -notlike "*Loopback*"
} | Select-Object -First 1).IPAddress

# ─── 3. Fungsi Bebaskan Port dari Proses Lama ───
function Free-Port([int]$TargetPort) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue
        if ($conns) {
            foreach ($conn in $conns) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -and $pidToKill -ne $PID -and $pidToKill -ne 0 -and $pidToKill -ne 4) {
                    Write-Host "[INFO] Port $TargetPort sedang digunakan oleh PID $pidToKill. Menghentikan..." -ForegroundColor DarkYellow
                    try {
                        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                        Start-Sleep -Milliseconds 300
                    } catch {}
                }
            }
        }
    } catch {}
}

# ─── 4. Fungsi Buka Browser Otomatis Saat Server Siap ───
function Open-Browser-When-Ready([string]$Url, [int]$TargetPort) {
    if ($NoBrowser) { return }
    Start-Job -ScriptBlock {
        param($targetUrl, $port)
        for ($i = 0; $i -lt 35; $i++) {
            Start-Sleep -Seconds 1
            try {
                $res = Invoke-WebRequest -Uri "http://localhost:$port/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($res -and $res.StatusCode -eq 200) { break }
            } catch {}
        }
        Start-Process $targetUrl
    } -ArgumentList $Url, $TargetPort | Out-Null
}

# ─── 5. Tampilan Header ───
function Show-Banner {
    Clear-Host
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "             🚀 NUENIME APP - SERVICE RUNNER               " -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " Runtime : $runtime $(if ($runtime -eq 'bun') { '(' + (bun --version) + ')' })" -ForegroundColor DarkGray
    if ($localIP) {
        Write-Host " IP LAN  : http://${localIP}" -ForegroundColor DarkGray
    }
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
}

# ─── 6. AKSI 1: Run Project (Nuenime App Utama) ───
function Start-Project {
    Free-Port -TargetPort 8081
    Free-Port -TargetPort 3000

    if ($ClearCache) {
        Write-Host "[INFO] Membersihkan Expo Cache..." -ForegroundColor Cyan
        Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [1] NUENIME APP UTAMA (Web + Server)" -ForegroundColor Green
    Write-Host "  Web App Metro     : " -NoNewline; Write-Host "http://localhost:8081" -ForegroundColor Cyan
    if ($localIP) {
        Write-Host "  Koneksi HP / APK  : " -NoNewline; Write-Host "http://${localIP}:8081" -ForegroundColor Yellow
    }
    Write-Host "  Backend API       : " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Green
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Tekan Ctrl + C untuk menghentikan server.`n" -ForegroundColor DarkGray

    Open-Browser-When-Ready -Url "http://localhost:8081" -TargetPort 8081

    if ($runtime -eq "bun") {
        bun run dev:project
    } else {
        npm run dev:project
    }
}

# ─── 7. AKSI 2: Run Dunia-Nuenime ───
function Start-Dunia {
    Free-Port -TargetPort 3001

    $duniaDir = Join-Path $rootDir "dunia-Nuenime"
    if (-not (Test-Path $duniaDir)) {
        Write-Host "[ERROR] Folder dunia-Nuenime tidak ditemukan!" -ForegroundColor Red
        return
    }

    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [2] DUNIA NUENIME (Vite Dev Server)" -ForegroundColor Yellow
    Write-Host "  Local URL         : " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Cyan
    if ($localIP) {
        Write-Host "  Koneksi HP / LAN  : " -NoNewline; Write-Host "http://${localIP}:3001" -ForegroundColor Yellow
    }
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Tekan Ctrl + C untuk menghentikan server.`n" -ForegroundColor DarkGray

    Open-Browser-When-Ready -Url "http://localhost:3001" -TargetPort 3001

    Push-Location $duniaDir
    try {
        if ($runtime -eq "bun") {
            bun run dev
        } else {
            npm run dev
        }
    } finally {
        Pop-Location
    }
}

# ─── 8. AKSI 3: Run NuePet Zoo ───
function Start-Nuepet {
    Free-Port -TargetPort 3002

    $nuepetDir = Join-Path $rootDir "nuepetzoo"
    if (-not (Test-Path $nuepetDir)) {
        Write-Host "[ERROR] Folder nuepetzoo tidak ditemukan!" -ForegroundColor Red
        return
    }

    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [3] NUEPET ZOO (3D Pet Island)" -ForegroundColor Green
    Write-Host "  Local URL         : " -NoNewline; Write-Host "http://localhost:3002" -ForegroundColor Cyan
    if ($localIP) {
        Write-Host "  Koneksi HP / LAN  : " -NoNewline; Write-Host "http://${localIP}:3002" -ForegroundColor Yellow
    }
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Tekan Ctrl + C untuk menghentikan server.`n" -ForegroundColor DarkGray

    Open-Browser-When-Ready -Url "http://localhost:3002" -TargetPort 3002

    Push-Location $nuepetDir
    try {
        if ($runtime -eq "bun") {
            bun run dev
        } else {
            npm run dev
        }
    } finally {
        Pop-Location
    }
}

# ─── 9. AKSI 4: Run Semua Sekaligus ───
function Start-AllServices {
    Free-Port -TargetPort 8081
    Free-Port -TargetPort 3000
    Free-Port -TargetPort 3001
    Free-Port -TargetPort 3002

    if ($ClearCache) {
        Write-Host "[INFO] Membersihkan Expo Cache..." -ForegroundColor Cyan
        Remove-Item -Path ".expo" -Recurse -Force -ErrorAction SilentlyContinue
    }

    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [4] MENJALANKAN SEMUA SERVICE SEKALIGUS" -ForegroundColor Magenta
    Write-Host "  Web App Utama     : " -NoNewline; Write-Host "http://localhost:8081" -ForegroundColor Cyan
    Write-Host "  Backend Server    : " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Green
    Write-Host "  Dunia Nuenime     : " -NoNewline; Write-Host "http://localhost:3001" -ForegroundColor Yellow
    Write-Host "  NuePet Zoo        : " -NoNewline; Write-Host "http://localhost:3002" -ForegroundColor Green
    if ($localIP) {
        Write-Host "  Koneksi HP Metro  : " -NoNewline; Write-Host "http://${localIP}:8081" -ForegroundColor Cyan
    }
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "Tekan Ctrl + C untuk menghentikan seluruh server bersamaan.`n" -ForegroundColor DarkGray

    Open-Browser-When-Ready -Url "http://localhost:8081" -TargetPort 8081
    Open-Browser-When-Ready -Url "http://localhost:3001" -TargetPort 3001
    Open-Browser-When-Ready -Url "http://localhost:3002" -TargetPort 3002

    if ($runtime -eq "bun") {
        bun run dev:all
    } else {
        npm run dev:all
    }
}

# ─── 10. EKSEKUSI SESUAI ARGUMEN ATAU MENU INTERAKTIF ───
Show-Banner

if ($Project) {
    Start-Project
    Exit 0
}

if ($Dunia) {
    Start-Dunia
    Exit 0
}

if ($Nuepet) {
    Start-Nuepet
    Exit 0
}

if ($All) {
    Start-AllServices
    Exit 0
}

# Menu Interaktif jika dijalankan tanpa parameter
Write-Host "Pilih service yang ingin kamu jalankan:" -ForegroundColor White
Write-Host "  [1] Run Project (Nuenime App Utama + Server + Web 8081)" -ForegroundColor Green
Write-Host "  [2] Run Dunia-Nuenime (Port 3001)" -ForegroundColor Yellow
Write-Host "  [3] Run NuePet Zoo (Port 3002)" -ForegroundColor Cyan
Write-Host "  [4] Run Semua Sekaligus (Project + Dunia + NuePet)" -ForegroundColor Magenta
Write-Host "  [5] Keluar" -ForegroundColor DarkGray
Write-Host ""

$pilihan = Read-Host "Masukkan nomor pilihan (1-5)"

switch ($pilihan) {
    "1" {
        Start-Project
    }
    "2" {
        Start-Dunia
    }
    "3" {
        Start-Nuepet
    }
    "4" {
        Start-AllServices
    }
    Default {
        Write-Host "`nSelesai. Tidak ada service yang dijalankan." -ForegroundColor DarkGray
    }
}
