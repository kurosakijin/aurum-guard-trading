@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe goto :missing
.venv\Scripts\python.exe train_ai.py --gold XAUUSD --silver XAGUSD %*
echo.
echo Review aurum_guard_ai_report.json before running the gate.
pause
exit /b %errorlevel%

:missing
echo Run install_ai.cmd first.
pause
exit /b 1
