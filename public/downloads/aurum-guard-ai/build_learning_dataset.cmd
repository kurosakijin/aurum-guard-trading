@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Run install_ai.cmd first.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" build_learning_dataset.py
pause
