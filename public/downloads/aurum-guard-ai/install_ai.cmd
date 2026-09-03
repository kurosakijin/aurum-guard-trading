@echo off
setlocal
cd /d "%~dp0"
py -3 -m venv .venv
if errorlevel 1 goto :python_error
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r requirements-ai.txt
if errorlevel 1 goto :install_error
echo.
echo Aurum Guard AI dependencies are installed.
echo Keep MT5 open and logged into DEMO before training.
pause
exit /b 0

:python_error
echo Python 3 was not found. Install it from python.org, then run this file again.
pause
exit /b 1

:install_error
echo The AI dependencies could not be installed. Check the internet connection and try again.
pause
exit /b 1

