@echo off
echo Starting ADK Agent Server...

if not exist .env (
    echo .env not found — copying from .env.example
    copy .env.example .env
    echo.
    echo !! Please edit .env and set your ANTHROPIC_API_KEY, then run again.
    pause
    exit /b 1
)

if not exist .venv (
    echo Creating virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate

echo Installing dependencies...
pip install -r requirements.txt -q

for /f "tokens=2 delims==" %%a in ('findstr "ADK_PORT" .env') do set ADK_PORT=%%a
if "%ADK_PORT%"=="" set ADK_PORT=8001

echo.
echo ADK Agent running on http://localhost:%ADK_PORT%
echo Agent: root_agent
echo Press Ctrl+C to stop
echo.

:: Run from adk_agent/ folder — ADK finds root_agent/ subfolder automatically
adk web --port %ADK_PORT%