@echo off
setlocal
cd /d "%~dp0"
python -u run_ai_gate.py --gold XAUUSD --silver XAGUSD --model aurum_guard_ai_v8_shadow.joblib --signal-file aurum_guard_ai_v8_shadow_signal.csv --history-file aurum_guard_ai_v8_forward_log.csv --max-equity-drawdown-percent 2.0
endlocal
