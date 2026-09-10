@echo off
setlocal
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe goto :missing
if not exist asheparte_ai_v9_shadow.joblib goto :model_missing
echo Asheparte AI v9 is a shadow-only research reading. It cannot place MT5 orders.
.venv\Scripts\python.exe -u run_ai_gate.py --gold XAUUSD --silver XAGUSD --model asheparte_ai_v9_shadow.joblib --signal-file asheparte_ai_v9_shadow_signal.csv --history-file asheparte_ai_v9_forward_log.csv --max-equity-drawdown-percent 2.0
exit /b %errorlevel%

:missing
echo Run install_ai.cmd first.
pause
exit /b 1

:model_missing
echo The v9 shadow model is missing. Download the complete AI layer again.
pause
exit /b 1
