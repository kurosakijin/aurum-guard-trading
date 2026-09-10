@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe goto :missing
if not exist aurum_guard_ai_model.joblib goto :model_missing
echo Asheparte AI only writes analysis probabilities. It cannot place MT5 orders.
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
