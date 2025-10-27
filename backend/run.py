"""
Flask application entry point.
"""

import os
from dotenv import load_dotenv
from app import create_app, scheduler
import logging

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Create Flask app
app = create_app(os.getenv('FLASK_ENV', 'development'))

if __name__ == '__main__':
    try:
        # Run Flask app
        app.run(
            host='0.0.0.0',
            port=5000,
            debug=app.config['DEBUG']
        )
    finally:
        # Shutdown scheduler when app stops
        if scheduler.running:
            scheduler.shutdown()
