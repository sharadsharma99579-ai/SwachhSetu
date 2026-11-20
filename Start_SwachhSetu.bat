@echo off
cd /d "%~dp0"
py -3 -c "import sys; sys.exit(sys.version_info < (3,10))" >nul 2>&1
if not errorlevel 1 (
  py -3 demo.py
  goto done
)
python -c "import sys; sys.exit(sys.version_info < (3,10))" >nul 2>&1
if not errorlevel 1 (
  python demo.py
  goto done
)
echo Python 3.10 or newer is required. Install it from https://www.python.org/downloads/ and run this file again.
:done
pause
