# Dockerfile
FROM node:16

# Install Python (required for yt-dlp)
RUN apt-get update && apt-get install -y python3

# Set environment variables
ENV PORT=3000
ENV TEMP_DOWNLOAD_DIR=/app/tmp
ENV MAX_UPLOAD=500
ENV MAXSOLICITUD=2

# Create necessary directories
RUN mkdir -p /app/tmp /app/media/bin

# Set working directory
WORKDIR /app

# Download yt-dlp binary for Linux
RUN wget -O /app/media/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux && \
    chmod +x /app/media/bin/yt-dlp

# Copy package.json and package-lock.json first to leverage Docker layer caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
