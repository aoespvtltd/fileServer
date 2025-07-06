import express from 'express';
import multer from 'multer';
import { join } from 'path';
import { mkdir, readdir, stat, unlink } from 'fs/promises';

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

// API endpoint to get all files
app.get('/api/files', async (req, res) => {
  try {
    const files = await readdir(uploadsDir);
    const baseUrl = getBaseUrl(req);
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = join(uploadsDir, filename);
        const stats = await stat(filePath);
        const timestamp = parseInt(filename.split('.')[0]);
        return {
          filename,
          originalName: filename.split('.').slice(0, -1).join('.'),
          size: stats.size,
          url: `${baseUrl}/files/${filename}`,
          uploadedAt: new Date(timestamp)
        };
      })
    );

    // Sort files by upload date (newest first)
    fileDetails.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
    
    res.json(fileDetails);
  } catch (error) {
    console.error('Error getting files:', error);
    res.status(500).json({ error: 'Failed to get files' });
  }
});

// Handle file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const baseUrl = getBaseUrl(req);
  const fileUrl = `${baseUrl}/files/${req.file.filename}`;
  res.json({ url: fileUrl });
});

// Handle file deletion
app.delete('/api/files/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = join(uploadsDir, filename);
    
    // Check if file exists
    try {
      await stat(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete the file
    await unlink(filePath);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
}); 
