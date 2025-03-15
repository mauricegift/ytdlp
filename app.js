const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const { exec: execCallback } = require('child_process');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

const exec = promisify(execCallback);
const app = express();
app.use(cors());


function isUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}


const FILE_TYPES = {
  video: {
    extensions: new Set(['mp4', 'mkv', 'avi', 'webm']),
    mimetype: 'video/mp4',
  },
  audio: {
    extensions: new Set(['mp3', 'wav', 'ogg', 'flac']),
    mimetype: 'audio/mpeg',
  },
};

function getFileDetails(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();

  for (const [category, typeInfo] of Object.entries(FILE_TYPES)) {
    if (typeInfo.extensions.has(ext)) {
      return {
        category,
        mimetype: typeInfo.mimetype,
      };
    }
  }

  return {
    category: 'document',
    mimetype: 'application/octet-stream',
  };
}

class MediaDownloader {
  constructor() {
    this.config = {
      tempDir: process.env.TEMP_DOWNLOAD_DIR || path.join(process.cwd(), 'tmp'),
      maxFileSize: (parseInt(process.env.MAX_UPLOAD, 10) * 1048576) || 524288000,
      ytDlpPath: path.join(process.cwd(), 'media', 'bin'),
      maxConcurrent: parseInt(process.env.MAXSOLICITUD, 10) || 2,
    };

    this.ytDlpBinaries = new Map([
      ['win32-x64', 'yt-dlp.exe'],
      ['win32-ia32', 'yt-dlp_x86.exe'],
      ['darwin', 'yt-dlp_macos'],
      ['linux-x64', 'yt-dlp_linux'],
      ['linux-arm64', 'yt-dlp_linux_aarch64'],
      ['linux-arm', 'yt-dlp_linux_armv7l'],
      ['default', 'yt-dlp'],
    ]);
  }

  async downloadWithYtDlp(url, format = 'best') {
    const ytDlpPath = await this.detectYtDlpBinary();
    const sessionId = `yt-dlp_${Date.now()}`;
    const outputDir = path.join(this.config.tempDir, sessionId);

    await fs.mkdir(outputDir, { recursive: true });

    const safePattern = path.join(outputDir, 'download.%(ext)s');
    const command = `${ytDlpPath} --max-filesize ${this.config.maxFileSize} -o "${safePattern}" -f "${format}" "${url}"`;

    try {
      await exec(command);
      const files = await fs.readdir(outputDir);
      if (files.length > 0) {
        const filePath = path.join(outputDir, files[0]);
        const fileDetails = getFileDetails(filePath);
        const fileBuffer = await fs.readFile(filePath);

        await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});

        return {
          buffer: fileBuffer,
          mimetype: fileDetails.mimetype,
          filename: files[0],
        };
      }
    } catch (error) {
      await fs.rm(outputDir, { recursive: true, force: true }).catch(() => {});
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async detectYtDlpBinary() {
    const platform = os.platform();
    const arch = os.arch();
    const key = `${platform}-${arch}`;
    return this.ytDlpBinaries.get(key) || this.ytDlpBinaries.get('default');
  }
}

const mediaDownloader = new MediaDownloader();

// Video Download Endpoint
app.get('/api/video', async (req, res) => {
  const { url, format = 'bestvideo[height<=720][ext=mp4][vcodec=h264]+bestaudio[acodec=aac]/best[height<=720][vcodec=h264]/best[ext=mp4]/best' } = req.query;

  if (!url || !isUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  try {
    const { buffer, mimetype, filename } = await mediaDownloader.downloadWithYtDlp(url, format);
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Audio Download Endpoint
app.get('/api/audio', async (req, res) => {
  const { url, format = 'bestaudio[ext=m4a]/bestaudio/best' } = req.query;

  if (!url || !isUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL provided' });
  }

  try {
    const { buffer, mimetype, filename } = await mediaDownloader.downloadWithYtDlp(url, format);
    res.setHeader('Content-Type', mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
