ARG BUILD_FROM=python:3.12-slim
ARG APP_REV=0.6.1
FROM ${BUILD_FROM}
ARG APP_REV

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    TECNOHEAD_DISPLAY_REV=${APP_REV}

WORKDIR /app

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY web ./web
COPY run.sh /run.sh
RUN chmod +x /run.sh

EXPOSE 8099
CMD ["/run.sh"]

