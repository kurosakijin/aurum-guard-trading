@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe goto :missing
echo Running expanding walk-forward AI shadow backtest...
.venv\Scripts\python.exe backtest_ai.py --gold XAUUSD --silver XAGUSD
echo.
echo Results saved to aurum_guard_ai_backtest.json.
pause
exit /b %errorlevel%

:missing
echo Run install_ai.cmd first.
pause
exit /b 1
