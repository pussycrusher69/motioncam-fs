# MCRAW Converter - Docker Deployment Guide

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+ (optional but recommended)
- At least 4GB RAM
- 10GB free disk space

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

### Using Docker CLI

```bash
# Build image
docker build -t mcraw-converter .

# Run container
docker run -d \
  --name mcraw-converter \
  -p 3000:3000 \
  -v $(pwd)/uploads:/app/uploads \
  -v $(pwd)/output:/app/output \
  -v $(pwd)/proxies:/app/proxies \
  mcraw-converter
```

## Accessing the App

Open your browser and navigate to:
```
http://localhost:3000
```

## Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|---------------|----------|
| `./uploads` | `/app/uploads` | Uploaded MCRAW files |
| `./output` | `/app/output` | Converted DNG files |
| `./proxies` | `/app/proxies` | Generated proxy files |

### Mounting External Directories

To process files from a specific directory:

```bash
docker run -d \
  -p 3000:3000 \
  -v /path/to/mcraw/files:/data/input:ro \
  -v /path/to/output:/app/output \
  mcraw-converter
```

## Troubleshooting

### Container won't start
```bash
docker logs mcraw-converter
```

### Build fails
```bash
# Clean build
docker build --no-cache -t mcraw-converter .
```

### Out of memory during processing
Increase Docker memory limit in Docker Desktop settings or use:
```bash
docker run --memory=8g ...
```

### Permission issues with volumes
```bash
chmod -R 777 uploads output proxies
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Node environment |
| `DECODER_PATH` | /usr/local/bin/motioncam-decoder | Path to decoder binary |
