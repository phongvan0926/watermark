@echo off
title LaMa Inpainting Studio
color 0B
cd /d "%~dp0"
echo ================================================================
echo        🦙 LaMa Inpainting Studio — Resolution-robust AI
echo ================================================================
echo.
echo [1/2] Kiem tra moi truong Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [LOI] Khong tim thay Python tren he thong. Vui long cai dat Python 3.10+.
    pause
    exit /b 1
)

echo [2/2] Dang khoi dong Web UI va mo trinh duyet...
echo.
python server.py
pause
