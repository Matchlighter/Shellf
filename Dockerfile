# Shellf server: serves the bootstrap script to shells and a WebUI to browsers.
FROM python:3.13-alpine

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    SHELLF_ROOT=/srv/shellf \
    PORT=8080

WORKDIR /app

COPY server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server/app.py .
COPY server/ui ./ui

# The payload: the script and its modules, served as static files.
COPY shlf /srv/shellf/shlf
COPY mods /srv/shellf/mods

RUN adduser -D -u 10001 shellf
USER shellf

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1

CMD ["python", "app.py"]
