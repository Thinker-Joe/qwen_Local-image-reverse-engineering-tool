#!/bin/bash

echo "Setting up Image Analysis API Service..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "Python 3 is not installed. Please install Python 3.8 or higher."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
else
    echo "Virtual environment already exists."
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Check if API key is set
if [ -z "$DASHSCOPE_API_KEY" ]; then
    echo "WARNING: DASHSCOPE_API_KEY environment variable is not set."
    echo "You will need to provide the API key when making requests."
fi

echo ""
echo "Setup complete! You can now run the API service with:"
echo "  source venv/bin/activate"
echo "  python app.py"
echo ""
echo "Or use the client example:"
echo "  source venv/bin/activate"
echo "  python client_example.py --api-key your-api-key path/to/image.jpg"
echo ""

# Function to open browser based on OS
open_browser() {
    # Wait for server to start
    echo "Waiting for server to start..."
    sleep 3
    
    # Open browser based on OS
    echo "Opening browser..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        open "http://localhost:5000"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command -v xdg-open &> /dev/null; then
            xdg-open "http://localhost:5000"
        elif command -v gnome-open &> /dev/null; then
            gnome-open "http://localhost:5000"
        else
            echo "Could not detect a browser opener. Please open http://localhost:5000 manually."
        fi
    else
        echo "Unknown OS. Please open http://localhost:5000 manually."
    fi
}

# Ask if user wants to start the server now
read -p "Do you want to start the server now? (y/n): " start_server
if [[ $start_server == "y" || $start_server == "Y" ]]; then
    echo "Starting server..."
    # Start server in background
    python app.py &
    SERVER_PID=$!
    
    # Open browser
    open_browser
    
    echo ""
    echo "Server is running in the background (PID: $SERVER_PID)."
    echo "Press Ctrl+C to stop it or run 'kill $SERVER_PID' from another terminal."
    
    # Wait for server process
    wait $SERVER_PID
else
    echo "Server not started."
fi 