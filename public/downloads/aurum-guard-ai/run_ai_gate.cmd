@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe goto :missing
if not exist aurum_guard_ai_model.joblib goto :model_missing
echo The AI gate only writes probabilities. Keep AIShadowMode=true in the EA first.
.venv\Scripts\python.exe run_ai_gate.py --gold XAUUSD --silver XAGUSD
exit /b %errorlevel%

:missing
echo Run install_ai.cmd first.
pause
exit /b 1

:model_missing
echo Run train_ai.cmd first.
pause
exit /b 1
