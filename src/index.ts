import express from 'express';
import multer from 'multer';
import { join } from 'path';
import { mkdir, readdir, stat, readFile, writeFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import https from 'https';
import http from 'http';
import fs from 'fs/promises';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';

// Create uploads directory if it doesn't exist
const uploadsDir = join(__dirname, 'uploads');
await mkdir(uploadsDir, { recursive: true });

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = file.originalname.split('.').pop();
    cb(null, `${timestamp}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Basic file type validation (optional, customize as needed)
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
});

// Middleware to enforce HTTPS if configured
app.use((req, res, next) => {
  if (FORCE_HTTPS && req.protocol === 'http') {
    return res.redirect(301, `https://${req.get('host')}${req.url}`);
  }
  next();
});

// Serve static files from uploads directory
app.use('/files', express.static(uploadsDir, {
  // Prevent directory traversal
  dotfiles: 'deny',
  index: false,
}));

// Serve the upload form
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'src/views/index.html'));
});

// Serve the files listing page
app.get('/files', (req, res) => {
  res.sendFile(join(__dirname, 'src/views/files.html'));
});

// Helper function to get the correct protocol and host
function getBaseUrl(req) {
  let protocol = req.get('X-Forwarded-Proto') || req.protocol;
  const host = req.get('X-Forwarded-Host') || req.get('host');
  
  if (FORCE_HTTPS) {
    protocol = 'https';
  }
  
  return `${protocol}://${host}`;
}

// Helper to get metadata path for a file
function getMetaPath(filename) {
  return join(uploadsDir, `${filename}.json`);
}

// API endpoint to get all files (with optional search)
app.get('/api/files', async (req, res) => {
  try {
    const search = req.query.search?.toString().toLowerCase() || '';
    const files = await readdir(uploadsDir);
    // Filter out metadata files
    const fileDetails = await Promise.all(
      files
        .filter(filename => !filename.endsWith('.json'))
        .map(async (filename) => {
          const filePath = join(UploadsDir, filename);
          const metaPath = getMetaPath(filename);
          const stats = await stat(filePath);
          let originalName = filename.split('.').slice(0, -1).join('.');
          let uploadedAt = new Date(parseInt(filename.split('.')[0]));
          
          // Try to read metadata
          try {
            const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
            if (meta.originalName) originalName = meta.originalName;
            if (meta.uploadedAt) uploadedAt = new Date(meta.uploadedAt);
          } catch {
            // No metadata found, use defaults
          }
          
          return {
            filename,
            originalName,
            size: stats.size,
            url: `${getBaseUrl(req)}/files/${filename}`,
            uploadedAt,
          };
        })
    );

    // Filter by search if provided
    const filtered = search
      ? fileDetails.filter(f => f.originalName.toLowerCase().includes(search))
      : fileDetails;

    // Sort files by upload date (newest first)
    filtered.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    res.json(filtered);
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

// Handle file upload (store metadata)
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `${getBaseUrl(req)}/files/${req.file.filename}`;
    
    // Save metadata
    const metaPath = getMetaPath(req.file.filename);
    const metadata = {
      originalName: req.file.originalname,
      uploadedAt: new Date().toISOString(),
    };
    await writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');

    res.json({ url: fileUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Error handling middleware for Multer errors
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds 100MB limit' });
    }
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

// Start the server (HTTP or HTTPS based on FORCE_HTTPS)
const startServer = async () => {
  if (FORCE_HTTPS) {
    try {
      const key = await fs.readFile(join(__dirname, 'ssl/key.pem'));
      const cert = await fs.readFile(join(__dirname, 'ssl/cert.pem'));
      const server = https.createServer({ key, cert }, app);
      server.listen(port, () => {
        console.log(`HTTPS Server running at https://localhost:${port}`);
      });
    } catch (error) {
      console.error('Failed to start HTTPS server:', error);
      process.exit(1);
    }
  } else {
    const server = http.createServer(app);
    server.listen(port, () => {
      console.log(`HTTP Server running at http://localhost:${port}`);
    });
  }
};

startServer();
