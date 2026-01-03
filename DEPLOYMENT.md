# MCRAW Converter - Deployment Guide

This web application processes MCRAW files from MotionCam using the official motioncam-decoder binary and Python for advanced RAW processing.

## Architecture

- **Frontend**: Next.js 16 with React 19
- **Backend**: Node.js API routes + Python processing scripts
- **Decoder**: motioncam-decoder (C++ binary)
- **Storage**: Vercel Blob for file storage
- **Deployment**: Docker container with all dependencies

## Prerequisites

- Docker Engine 20.10+
- Docker Compose v2.0+
- 4GB+ RAM (8GB recommended)
- 10GB+ free disk space
- Vercel Blob token (for storage)

## Quick Start

### 1. Clone and Setup

```bash
git clone <your-repo>
cd motioncam-fs-web
```

### 2. Configure Environment

Create a `.env.local` file:

```bash
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

### 3. Build and Run with Docker

```bash
# Build and start
docker compose up -d --build

# View logs
docker compose logs -f

# Stop
docker compose down
```

### 4. Access Application

Open your browser: `http://localhost:3000`

## Local Development (without Docker)

### Requirements

- Node.js 18+
- Python 3.8+
- motioncam-decoder binary (compiled and in PATH)

### Setup

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
pip3 install -r requirements.txt

# Build motioncam-decoder (if not already available)
git clone https://github.com/mirsadm/motioncam-decoder.git
cd motioncam-decoder
mkdir build && cd build
cmake .. && make
sudo cp example /usr/local/bin/motioncam-decoder

# Run development server
npm run dev
```

## Processing Workflow

1. **Upload MCRAW** - Files are uploaded to Vercel Blob
2. **Parse Metadata** - Extract file info using motioncam-decoder
3. **Configure Settings** - Adjust exposure, crop, transfer curves, etc.
4. **Process Frames** - Python script calls decoder and applies settings
5. **Download DNGs** - Processed files available via Blob URLs

## Python Scripts

- `scripts/mcraw_decoder.py` - Main decoder wrapper class
- `scripts/process_mcraw.py` - CLI processing script

### Testing Scripts Locally

```bash
# Extract metadata
python3 scripts/mcraw_decoder.py sample.mcraw

# Process with settings
python3 scripts/process_mcraw.py sample.mcraw ./output '{"exposureCompensation": 10, "transferCurve": "srgb"}'
```

## Troubleshooting

### Decoder Not Found

```bash
# Verify decoder is available
docker exec mcraw-converter which motioncam-decoder
docker exec mcraw-converter motioncam-decoder --help
```

### Python Import Errors

```bash
# Check Python packages
docker exec mcraw-converter pip3 list | grep rawpy
```

### Memory Issues

Increase Docker memory limit in Docker Desktop or:

```bash
docker run --memory=8g ...
```

### Build Failures

```bash
# Clean build
docker compose down
docker rmi mcraw-converter
docker compose up --build
```

## Production Deployment

### Vercel Deployment

Note: Vercel serverless functions have limitations for this use case:
- Max execution time: 300s
- Max request size: 4.5MB
- No C++ binary support

**Recommendation**: Use Docker deployment on a VPS or dedicated server.

### VPS Deployment

```bash
# On your VPS
git clone <your-repo>
cd motioncam-fs-web

# Set environment variables
echo "BLOB_READ_WRITE_TOKEN=your_token" > .env.local

# Start with Docker Compose
docker compose up -d

# Setup reverse proxy (nginx)
# Configure SSL with Let's Encrypt
```

## File Structure

```
motioncam-fs-web/
├── app/
│   ├── api/
│   │   ├── upload/route.ts       # File upload handler
│   │   ├── parse-mcraw/route.ts  # Metadata extraction
│   │   └── process/route.ts      # Main processing endpoint
│   ├── app/page.tsx              # Main application UI
│   └── page.tsx                  # Landing page
├── scripts/
│   ├── mcraw_decoder.py          # Python decoder wrapper
│   └── process_mcraw.py          # Processing script
├── components/                    # React components
├── Dockerfile                     # Docker configuration
├── docker-compose.yml             # Docker Compose config
└── requirements.txt               # Python dependencies
```

## Environment Variables

- `BLOB_READ_WRITE_TOKEN` - Vercel Blob storage token
- `DECODER_PATH` - Path to motioncam-decoder binary (default: `/usr/local/bin/motioncam-decoder`)
- `NODE_ENV` - Node environment (production/development)

## Support

For issues related to:
- **MCRAW format**: https://github.com/mirsadm/motioncam-decoder
- **MotionCam app**: https://www.motioncamapp.com/
- **This web app**: Open an issue in the repository
