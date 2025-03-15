# Dockerfile
FROM node:16

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=3000
ENV TEMP_DOWNLOAD_DIR=/app/tmp
ENV MAX_UPLOAD=500
ENV MAXSOLICITUD=2

RUN mkdir -p /app/tmp
RUN mkdir -p /app/media/bin

# Download yt-dlp binary for Linux
RUN wget -O /app/media/bin/yt-dlp https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux
RUN chmod +x /app/media/bin/yt-dlp

EXPOSE 3000

CMD ["npm", "start"]
