# Development image for the Flask backend.
# Source is bind-mounted by docker-compose, so Flask's reloader picks up host edits.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Dependencies first so edits to app code do not invalidate the pip layer.
# psycopg2-binary ships its own libpq, so no apt packages are needed.
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "run.py"]
