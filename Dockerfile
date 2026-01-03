# Multi-stage build for MCRAW converter

# Stage 1: Build motioncam-decoder
FROM ubuntu:22.04 AS decoder-builder

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libz-dev \
    libjpeg-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

# Clone and build motioncam-decoder
WORKDIR /build
RUN git clone https://github.com/mirsadm/motioncam-decoder.git
WORKDIR /build/motioncam-decoder
RUN mkdir -p build && cd build && \
    cmake .. && \
    make -j$(nproc)

# Stage 2: Runtime environment
FROM node:18-bullseye

ENV DEBIAN_FRONTEND=noninteractive

# Install Python and system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    imagemagick \
    libgomp1 \
    libjpeg62-turbo \
    libpng16-16 \
    libz1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python packages
RUN pip3 install --no-cache-dir \
    rawpy \
    numpy \
    imageio \
    pillow \
    numba

# Copy decoder binary from builder stage
COPY --from=decoder-builder /build/motioncam-decoder/build/example /usr/local/bin/motioncam-decoder
RUN chmod +x /usr/local/bin/motioncam-decoder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy application code
COPY . .

# Build Next.js app
RUN npm run build

# Create directories for processing
RUN mkdir -p /app/uploads /app/output /app/temp

# Set environment variables
ENV DECODER_PATH=/usr/local/bin/motioncam-decoder
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
