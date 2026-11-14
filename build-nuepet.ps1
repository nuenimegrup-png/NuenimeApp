# ==============================================================================
# NuePet Zoo - Build & Deployment PowerShell Script
# Otomasi: Build Vite, Typecheck (Lint), Dev Server, Preview & Push ke GitHub
# ==============================================================================

param (
    [switch]$Build,
    [switch]$Push,
    [switch]$Lint,
    [switch]$Dev,
    [switch]$Preview,
    [string]$CommitMessage = ""
)

$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# Pastikan lokasi berada di direktori project root
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }
$nuepetDir = Join-Path $rootDir "nuepetzoo"

if (-not (Test-Path $nuepetDir)) {
    Write-Host "[ERROR] Folder nuepetzoo tidak ditemukan di: $nuepetDir" -ForegroundColor Red
    Exit 1
}

function Show-Header {
    Clear-Host
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "           🐾 NUEPET ZOO - BUILD & DEPLOY MANAGER          " -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " Lokasi Folder : $nuepetDir" -ForegroundColor DarkGray
    Write-Host " Target Deploy : GitHub (nuenimegrup-png/NuePet-Zoo)" -ForegroundColor DarkGray
    Write-Host " Hosting Live  : https://nuepet-zoo.vercel.app" -ForegroundColor DarkGray
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host ""
}

# Deteksi runtime Bun / Node / NPM
$pkgMgr = "bun"
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $pkgMgr = "npm"
        Write-Host "[INFO] Bun tidak terdeteksi, menggunakan npm." -ForegroundColor Yellow
    } else {
        Write-Host "[ERROR] Bun atau Node.js belum terpasang di sistem!" -ForegroundColor Red
        Exit 1
    }
} else {
    Write-Host "[OK] Runtime terdeteksi: Bun ($(bun --version))" -ForegroundColor Green
}

function Run-Lint {
    Write-Host "`n[1/2] Menjalankan Typecheck (TypeScript Lint)..." -ForegroundColor Cyan
    Push-Location $nuepetDir
    try {
        if ($pkgMgr -eq "bun") {
            & bun run lint
        } else {
            & npm run lint
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Typecheck Lulus (0 Error)!" -ForegroundColor Green
            return $true
        } else {
            Write-Host "[ERROR] Typecheck gagal dengan exit code $LASTEXITCODE" -ForegroundColor Red
            return $false
        }
    } finally {
        Pop-Location
    }
}

function Run-Build {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    Write-Host "`n[2/2] Membangun Produksi (Vite Build)..." -ForegroundColor Cyan
    Push-Location $nuepetDir
    try {
        if ($pkgMgr -eq "bun") {
            & bun run build
        } else {
            & npm run build
        }
        $sw.Stop()
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Build NuePet Zoo Berhasil! Selesai dalam $([math]::Round($sw.Elapsed.TotalSeconds, 2)) detik." -ForegroundColor Green
            Write-Host "[INFO] File bundel tersimpan di: $nuepetDir\dist" -ForegroundColor DarkGray
            return $true
        } else {
            Write-Host "[ERROR] Build gagal dengan exit code $LASTEXITCODE" -ForegroundColor Red
            return $false
        }
    } finally {
        Pop-Location
    }
}

function Run-Push {
    Write-Host "`n[GIT] Memeriksa perubahan di git nuepetzoo..." -ForegroundColor Cyan
    Push-Location $nuepetDir
    try {
        $status = & git status --porcelain
        if (-not $status) {
            Write-Host "[INFO] Tidak ada perubahan file di nuepetzoo yang perlu di-commit." -ForegroundColor Yellow
            $reply = Read-Host "Apakah tetap ingin git push origin main? (y/N)"
            if ($reply -ne "y" -and $reply -ne "Y") {
                return
            }
        } else {
            Write-Host "[INFO] Perubahan terdeteksi:" -ForegroundColor Cyan
            & git status -s

            $msg = $CommitMessage
            if (-not $msg) {
                Write-Host ""
                $msg = Read-Host "Masukkan pesan commit (tekan Enter untuk default: 'update nuepet build')"
                if (-not $msg) {
                    $msg = "update: nuepet build & improvements ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
                }
            }

            Write-Host "`n[GIT] Melakukan git add & commit..." -ForegroundColor Cyan
            & git add -A
            & git commit -m "$msg"
        }

        Write-Host "`n[GIT] Mengambil update terbaru & rebase (git pull --rebase)..." -ForegroundColor Cyan
        & git pull --rebase origin main

        Write-Host "`n[GIT] Mengunggah perubahan ke GitHub (git push origin main)..." -ForegroundColor Magenta
        & git push origin main

        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "==========================================================" -ForegroundColor Green
            Write-Host " [BERHASIL] NuePet Zoo ter-push ke GitHub!" -ForegroundColor Green
            Write-Host " Vercel otomatis mendeploy versi terbaru ke:" -ForegroundColor Green
            Write-Host " -> https://nuepet-zoo.vercel.app" -ForegroundColor Yellow
            Write-Host "==========================================================" -ForegroundColor Green
        } else {
            Write-Host "[ERROR] Gagal melakukan push ke GitHub!" -ForegroundColor Red
        }
    } finally {
        Pop-Location
    }
}

function Run-DevServer {
    Write-Host "`n[DEV] Menjalankan Server Pengembangan NuePet (Port 3002)..." -ForegroundColor Magenta
    Push-Location $nuepetDir
    try {
        if ($pkgMgr -eq "bun") {
            & bun run dev
        } else {
            & npm run dev
        }
    } finally {
        Pop-Location
    }
}

function Run-Preview {
    Write-Host "`n[PREVIEW] Menjalankan Preview Hasil Build Produksi..." -ForegroundColor Cyan
    Push-Location $nuepetDir
    try {
        if ($pkgMgr -eq "bun") {
            & bun run preview
        } else {
            & npm run preview
        }
    } finally {
        Pop-Location
    }
}

# ==============================================================================
# LOGIKA EKSEKUSI SESUAI PARAMETER ATAU MENU INTERAKTIF
# ==============================================================================

Show-Header

if ($Lint) {
    [void](Run-Lint)
    Exit 0
}

if ($Build) {
    if (Run-Lint) {
        [void](Run-Build)
    }
    Exit 0
}

if ($Push) {
    if (Run-Lint) {
        if (Run-Build) {
            Run-Push
        }
    }
    Exit 0
}

if ($Dev) {
    Run-DevServer
    Exit 0
}

if ($Preview) {
    Run-Preview
    Exit 0
}

# Jika dijalankan tanpa parameter, tampilkan Menu Pilihan
Write-Host "Pilih aksi yang ingin dijalankan:" -ForegroundColor White
Write-Host "  [1] Build Produksi (Lint + Vite Build)" -ForegroundColor Green
Write-Host "  [2] Build + Push Langsung ke GitHub (Otomatis Deploy Vercel)" -ForegroundColor Magenta
Write-Host "  [3] Typecheck / Lint Saja (Cek Error TypeScript)" -ForegroundColor Yellow
Write-Host "  [4] Jalankan Dev Server (Vite Port 3002)" -ForegroundColor Cyan
Write-Host "  [5] Preview Hasil Build Produksi" -ForegroundColor Blue
Write-Host "  [6] Keluar" -ForegroundColor DarkGray
Write-Host ""

$pilihan = Read-Host "Masukkan nomor pilihan (1-6)"

switch ($pilihan) {
    "1" {
        if (Run-Lint) {
            [void](Run-Build)
        }
    }
    "2" {
        if (Run-Lint) {
            if (Run-Build) {
                Run-Push
            }
        }
    }
    "3" {
        [void](Run-Lint)
    }
    "4" {
        Run-DevServer
    }
    "5" {
        Run-Preview
    }
    Default {
        Write-Host "Selesai. Tidak ada aksi yang dijalankan." -ForegroundColor DarkGray
    }
}

Write-Host ""
Read-Host "Tekan Enter untuk menutup jendela ini..."
