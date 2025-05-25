# Selenium Bot API

A FastAPI-based web service that provides Selenium automation capabilities through a REST API.

## Prerequisites

- Python 3.8 or higher
- Chrome browser installed
- pip (Python package manager)

## Setup

1. Create a virtual environment (recommended):
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Application

Start the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, you can access the interactive API documentation at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### POST /bot/execute
Execute a Selenium bot action.

Request body:
```json
{
    "url": "https://example.com",
    "action": "your_action_here"
}
```

## Notes

- The bot runs in headless mode by default
- Make sure Chrome is installed on your system
- The webdriver will be automatically downloaded and managed by webdriver-manager 