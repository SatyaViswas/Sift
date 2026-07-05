FROM python:3.13-slim

# Install system dependencies and Node.js
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy Node.js dependencies
COPY package.json package-lock.json* ./
RUN npm install

# Copy Python dependencies
COPY requirements.txt ./
# Make sure to install standard dependencies along with uv/gunicorn if needed,
# though we are just running memory_bridge.py via uvicorn/fastapi natively for now.
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application code
COPY . .

# Ensure the start script is executable
RUN chmod +x start.sh

# Expose the gateway port for Hugging Face Spaces (Must be 7860)
ENV PORT=7860
EXPOSE 7860
EXPOSE 8000

# Start both services
CMD ["./start.sh"]
