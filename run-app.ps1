# ==============================================================================
# Nuenime App - PowerShell Launcher Script
# Menjalankan:
# 1. Web App Utama (Expo Metro - Port 8081)
# 2. Dunia Nuenime RPG (Vite React - Port 3001)
# 3. Backend API Server (Node/Express - Port 3000)
# ==============================================================================

param (
    [int]$Port = 8081,
    [int]$DuniaPort = 3001,
    [switch]$NoBrowser,
    [switch]$ClearCache
)

$ErrorActionPreference = "Stop"

# Set encoding & working directory ke root project
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location -Path $PSScriptRoot

Clear-Host
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "         NUENIME APP + DUNIA NUENIME LAUNCHER             " -ForegroundColor Yellow
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

# 2. Bebaskan port 8081, 5173, dan 3000 dari proses lama yang mungkin masih mengunci
function Free-Port([int]$TargetPort) {
    $conns = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue
    if ($conns) {
        foreach ($conn in $conns) {
            $pidToKill = $conn.OwningProcess
            if ($pidToKill -and $pidToKill -ne $PID -and $pidToKill -ne 0 -and $pidToKill -ne 4) {
                Write-Host "[INFO] Port $TargetPort sedang digunakan oleh PID $pidToKill. Menghentikan proses lama..." -ForegroundColor Yellow
                try {
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                    Start-Sleep -Milliseconds 400
                } catch {}
            }
        }
    }
}

Free-Port -TargetPort $Port
Free-Port -TargetPort 3000
Free-Port -TargetPort $DuniaPort

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
Write-Host "  Web App Utama     : " -NoNewline; Write-Host "http://localhost:$Port" -ForegroundColor Green
if ($localIP) {
Write-Host "  Koneksi HP / APK  : " -NoNewline; Write-Host "http://${localIP}:$Port" -ForegroundColor Cyan
}
Write-Host "  Dunia Nuenime RPG : " -NoNewline; Write-Host "http://localhost:$DuniaPort" -ForegroundColor Yellow
if ($localIP) {
Write-Host "  Dunia Nuenime HP  : " -NoNewline; Write-Host "http://${localIP}:$DuniaPort" -ForegroundColor Cyan
}
Write-Host "  Backend Server    : " -NoNewline; Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host "----------------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "[INFO] Menjalankan seluruh server (Nuenime App + Dunia Nuenime)..." -ForegroundColor Magenta
Write-Host "       Tekan Ctrl + C di terminal ini untuk berhenti bersamaan." -ForegroundColor DarkGray
Write-Host ""

# 5. Buka browser otomatis untuk Web App Utama dan Dunia Nuenime RPG
if (-not $NoBrowser) {
    # Buka Web App Utama (Port 8081)
    Start-Job -ScriptBlock {
        param($targetUrl, $targetPort)
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            try {
                $res = Invoke-WebRequest -Uri "http://localhost:$targetPort/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($res -and $res.StatusCode -eq 200) {
                    break
                }
            } catch {}
        }
        Start-Process $targetUrl
    } -ArgumentList "http://localhost:$Port", $Port | Out-Null

    # Buka Dunia Nuenime RPG (Port 3001)
    Start-Job -ScriptBlock {
        param($targetUrl, $targetPort)
        for ($i = 0; $i -lt 30; $i++) {
            Start-Sleep -Seconds 1
            try {
                $res = Invoke-WebRequest -Uri "http://localhost:$targetPort/" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($res -and $res.StatusCode -eq 200) {
                    break
                }
            } catch {}
        }
        Start-Process $targetUrl
    } -ArgumentList "http://localhost:$DuniaPort", $DuniaPort | Out-Null
}

# 6. Jalankan server dev utama (Server + Metro + Dunia Nuenime)
if ($runtime -eq "bun") {
    bun run dev
} else {
    npm run dev
}
