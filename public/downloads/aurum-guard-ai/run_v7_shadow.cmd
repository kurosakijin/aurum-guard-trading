@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe goto :missing
if not exist aurum_guard_ai_v7_shadow.joblib goto :model_missing
echo V7 is an unpromoted shadow challenger. It cannot authorize an MT5 order.
.venv\Scripts\python.exe run_ai_gate.py --gold XAUUSD --silver XAGUSD --model aurum_guard_ai_v7_shadow.joblib --signal-file aurum_guard_ai_v7_shadow_signal.csv --history-file aurum_guard_ai_v7_forward_log.csv
exit /b %errorlevel%

:missing
echo Run install_ai.cmd first.
pause
exit /b 1

:model_missing
echo The v7 shadow model is missing.
pause
exit /b 1
