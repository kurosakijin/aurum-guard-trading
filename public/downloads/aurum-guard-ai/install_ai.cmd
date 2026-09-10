@echo off
setlocal
cd /d "%~dp0"

set "PYTHON_EXE="
set "PYTHON_ARGS="

where py >nul 2>nul
if not errorlevel 1 (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_EXE=py"
    set "PYTHON_ARGS=-3"
  )
)

if not defined PYTHON_EXE (
  where python >nul 2>nul
  if not errorlevel 1 (
    python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_EXE=python"
  )
)

if not defined PYTHON_EXE (
  where python3 >nul 2>nul
  if not errorlevel 1 (
    python3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
    if not errorlevel 1 set "PYTHON_EXE=python3"
  )
)

if not defined PYTHON_EXE (
  set "CODEX_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" set "PYTHON_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
)

if not defined PYTHON_EXE goto :python_error

echo Using Python: %PYTHON_EXE% %PYTHON_ARGS%
if /i "%~1"=="--check" (
  "%PYTHON_EXE%" %PYTHON_ARGS% -c "import sys; print(sys.version)"
  exit /b %errorlevel%
)
"%PYTHON_EXE%" %PYTHON_ARGS% -m venv .venv
if errorlevel 1 goto :venv_error

.venv\Scripts\python.exe -m pip install --upgrade pip
if errorlevel 1 goto :install_error
.venv\Scripts\python.exe -m pip install -r requirements-ai.txt
if errorlevel 1 goto :install_error
echo.
echo Asheparte AI dependencies are installed.
echo Keep MT5 open and logged into a demo account before running the shadow layer.
pause
exit /b 0

:python_error
echo Python 3.10 or newer was not found.
echo Install Python from https://www.python.org/downloads/windows/
echo During setup, enable "Add python.exe to PATH", then run this file again.
pause
exit /b 1

:venv_error
echo Python was found, but the private AI environment could not be created.
echo Make sure this folder is writable and has at least 500 MB free, then try again.
pause
exit /b 1

:install_error
echo The AI dependencies could not be installed. Check the internet connection and try again.
pause
exit /b 1
