# 1. Use an official lightweight Python image
FROM python:3.10-slim

# 2. Set environment variables to prevent Python from writing pyc files
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# 3. Set work directory
WORKDIR /app

# 4. Install system dependencies (needed for some Python packages)
RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

# 5. Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 6. Copy the application code
COPY . .

# 7. Expose the port Render uses (default is 10000)
EXPOSE 10000

# 8. Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "10000"]