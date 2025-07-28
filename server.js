import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, 'uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `webcam-${Date.now()}.mp4`);
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'video/mp4') {
            cb(null, true);
        } else {
            cb(new Error('Only MP4 files are allowed'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.static('.'));
app.use('/recordings', express.static('recordings'));
app.use('/uploads', express.static('uploads'));

// CORS headers for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});

// Upload webcam video endpoint
app.post('/api/upload-webcam', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file uploaded' });
        }

        // Copy uploaded file to replace sample.mp4
        const samplePath = path.join(__dirname, 'sample.mp4');
        await fs.copyFile(req.file.path, samplePath);

        res.json({
            success: true,
            filename: req.file.filename,
            size: req.file.size,
            path: req.file.path
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Failed to upload video' });
    }
});

// Start recording endpoint
app.post('/api/record', async (req, res) => {
    const { websites, circleSize, position } = req.body;

    if (!websites || !Array.isArray(websites) || websites.length === 0) {
        return res.status(400).json({ error: 'At least one website is required' });
    }

    try {
        // Create a unique recording ID
        const recordingId = Date.now();
        
        // Run the multi-site recording script with parameters
        const recordingProcess = spawn('node', [
            'record-multi-webcam.js',
            '--websites', JSON.stringify(websites),
            '--size', circleSize || '200',
            '--position', `${position?.x || 'bottom'}-${position?.y || 'right'}`,
            '--recordingId', recordingId.toString()
        ], {
            cwd: __dirname
        });

        let output = '';
        let errorOutput = '';

        recordingProcess.stdout.on('data', (data) => {
            output += data.toString();
            console.log('Recording output:', data.toString());
        });

        recordingProcess.stderr.on('data', (data) => {
            errorOutput += data.toString();
            console.error('Recording error:', data.toString());
        });

        recordingProcess.on('close', (code) => {
            if (code === 0) {
                // Find the generated video file
                const recordingPath = path.join(__dirname, 'recordings', `final-${recordingId}.mp4`);
                res.json({
                    success: true,
                    recordingId,
                    videoUrl: `/recordings/final-${recordingId}.mp4`,
                    message: 'Recording completed successfully'
                });
            } else {
                res.status(500).json({
                    error: 'Recording failed',
                    details: errorOutput || 'Unknown error'
                });
            }
        });

    } catch (error) {
        console.error('Recording error:', error);
        res.status(500).json({ error: 'Failed to start recording' });
    }
});

// Get recordings list endpoint
app.get('/api/recordings', async (req, res) => {
    try {
        const recordingsDir = path.join(__dirname, 'recordings');
        const files = await fs.readdir(recordingsDir);
        
        const recordings = await Promise.all(
            files
                .filter(file => file.startsWith('final-') && file.endsWith('.mp4'))
                .map(async (file) => {
                    const stats = await fs.stat(path.join(recordingsDir, file));
                    const id = file.replace('final-', '').replace('.mp4', '');
                    return {
                        id,
                        filename: file,
                        videoUrl: `/recordings/${file}`,
                        size: stats.size,
                        created: stats.birthtime
                    };
                })
        );

        recordings.sort((a, b) => b.created - a.created);
        res.json(recordings);
    } catch (error) {
        console.error('Error listing recordings:', error);
        res.status(500).json({ error: 'Failed to list recordings' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log('Open index.html in your browser to use the application');
});