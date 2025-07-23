import express from 'express';
import multer from 'multer';
import { join } from 'path';
import { mkdir, readdir, stat } from 'fs/promises';

const app = express();
const port = process.env.PORT || 3000;

// Configuration for HTTPS
const FORCE_HTTPS = process.env.FORCE_HTTPS === 'true';

// Create uploads directory if it doesn't exist
const uploadsDir = join(process.cwd(), 'uploads');
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
});

// Serve static files from uploads directory
app.use('/files', express.static(uploadsDir));

// Serve the upload form
app.get('/', (req, res) => {
  res.sendFile(join(process.cwd(), 'src/views/index.html'));
});

// Serve the files listing page
app.get('/files', (req, res) => {
  res.sendFile(join(process.cwd(), 'src/views/files.html'));
});

// Helper function to get the correct protocol and host
function getBaseUrl(req: express.Request): string {
  // Check for X-Forwarded-Proto header (set by reverse proxies)
  let protocol = req.get('X-Forwarded-Proto') || req.protocol;
  const host = req.get('X-Forwarded-Host') || req.get('host');
  
  // Force HTTPS if configured
  if (FORCE_HTTPS) {
    protocol = 'https';
  }
  
  return `${protocol}://${host}`;
}


// Helper to get metadata path for a file
function getMetaPath(filename: string) {
  return join(uploadsDir, filename + '.json');
}

// API endpoint to get all files (with optional search)
app.get('/api/files', async (req, res) => {
  try {
    const files = await readdir(uploadsDir);
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = join(uploadsDir, filename);
        const metaPath = getMetaPath(filename);
        const stats = await stat(filePath);
        let originalName = filename.split('.').slice(0, -1).join('.');
        let uploadedAt = new Date(parseInt(filename.split('.')[0]));
        // Try to read metadata
        try {
          const meta = JSON.parse(await readFile(metaPath, 'utf-8'));
          if (meta.originalName) originalName = meta.originalName;
          if (meta.uploadedAt) uploadedAt = new Date(meta.uploadedAt);
        } catch {}
        return {
          filename,
          originalName,
          size: stats.size,
          url: `${req.protocol}://${req.get('host')}/files/${filename}`,
          uploadedAt: new Date(timestamp)
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
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `${req.protocol}://${req.get('host')}/files/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 
