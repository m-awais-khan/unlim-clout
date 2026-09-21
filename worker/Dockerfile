FROM python:3.12-slim-bookworm

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install official google-colab-cli
RUN pip install --no-cache-dir google-colab-cli

# Copy worker application files
COPY . .

# Setup work directories and environment
ENV REQUEST_TIMEOUT=86400
RUN mkdir -p /content/tmp_jobs /root/.config/colab-cli


EXPOSE 8001

CMD ["uvicorn", "worker_server:app", "--host", "0.0.0.0", "--port", "8001"]
