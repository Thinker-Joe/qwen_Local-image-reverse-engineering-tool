@echo off
echo Setting up Image Analysis API Service...

REM Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python is not installed or not in PATH. Please install Python 3.8 or higher.
    exit /b 1
)

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
) else (
    echo Virtual environment already exists.
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Check if API key is set
if not defined DASHSCOPE_API_KEY (
    echo WARNING: DASHSCOPE_API_KEY environment variable is not set.
    echo You will need to provide the API key when making requests.
)

echo.
echo Setup complete! You can now run the API service with:
echo   call venv\Scripts\activate.bat
echo   python app.py
echo.
echo Or use the client example:
echo   call venv\Scripts\activate.bat
echo   python client_example.py --api-key your-api-key path/to/image.jpg
echo.

REM Ask if user wants to start the server now
set /p start_server="Do you want to start the server now? (y/n): "
if /i "%start_server%"=="y" (
    echo Starting server...
    start /b cmd /c "python app.py"
    
    REM Wait for server to start
    echo Waiting for server to start...
    timeout /t 3 /nobreak > nul
    
    REM Open browser
    echo Opening browser...
    start http://localhost:5000
    
    echo.
    echo Server is running in the background. Press Ctrl+C in the server window to stop it.
) else (
    echo Server not started.
) 