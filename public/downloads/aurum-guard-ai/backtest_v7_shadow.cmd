@echo off
setlocal
cd /d "%~dp0"
python backtest_v7_shadow.py
if errorlevel 1 pause
endlocal
