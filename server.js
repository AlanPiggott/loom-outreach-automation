import express from 'express';
import multer from 'multer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import cloudflareStream from './cloudflare-stream.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// In-memory storage for recording metadata (in production, use a database)
const recordingsMetadata = new Map();

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

        recordingProcess.on('close', async (code) => {
            if (code === 0) {
                // Find the generated video file
                const recordingPath = path.join(__dirname, 'recordings', `final-${recordingId}.mp4`);
                
                // Store initial metadata
                const metadata = {
                    recordingId,
                    localPath: recordingPath,
                    videoUrl: `/recordings/final-${recordingId}.mp4`,
                    websites,
                    created: new Date(),
                    cloudflareStatus: 'pending',
                    cloudflareVideoId: null,
                    cloudflareUrls: null
                };
                recordingsMetadata.set(recordingId.toString(), metadata);
                
                // Send immediate response
                res.json({
                    success: true,
                    recordingId,
                    videoUrl: `/recordings/final-${recordingId}.mp4`,
                    message: 'Recording completed successfully',
                    cloudflareStatus: 'pending'
                });
                
                // Auto-upload to Cloudflare if enabled
                if (process.env.CLOUDFLARE_AUTO_UPLOAD === 'true') {
                    uploadToCloudflare(recordingId, recordingPath);
                }
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

// Helper function to upload to Cloudflare
async function uploadToCloudflare(recordingId, filePath) {
    try {
        const metadata = recordingsMetadata.get(recordingId.toString());
        if (!metadata) return;
        
        console.log(`🚀 Starting Cloudflare upload for recording ${recordingId}`);
        metadata.cloudflareStatus = 'uploading';
        
        // Track upload progress
        cloudflareStream.on('progress', (data) => {
            metadata.uploadProgress = data.progress;
            console.log(`Upload progress: ${data.progress}%`);
        });
        
        // Upload to Cloudflare
        const uploadResult = await cloudflareStream.uploadVideo(filePath, {
            name: `Recording ${recordingId} - ${metadata.websites.length} websites`
        });
        
        metadata.cloudflareStatus = 'processing';
        metadata.cloudflareVideoId = uploadResult.videoId;
        metadata.cloudflareUrls = {
            playback: uploadResult.playbackUrl,
            embed: uploadResult.embedUrl,
            thumbnail: uploadResult.thumbnail,
            dash: uploadResult.dashUrl,
            hls: uploadResult.hlsUrl
        };
        
        // Wait for video to be ready
        cloudflareStream.on('status', (status) => {
            metadata.processingStatus = status;
        });
        
        const readyDetails = await cloudflareStream.waitForVideoReady(uploadResult.videoId);
        
        metadata.cloudflareStatus = 'ready';
        metadata.cloudflareReady = true;
        metadata.cloudflareDuration = readyDetails.duration;
        
        console.log(`✅ Cloudflare upload complete for recording ${recordingId}`);
        
    } catch (error) {
        console.error(`Failed to upload recording ${recordingId} to Cloudflare:`, error);
        const metadata = recordingsMetadata.get(recordingId.toString());
        if (metadata) {
            metadata.cloudflareStatus = 'failed';
            metadata.cloudflareError = error.message;
        }
    }
}

// Get recording status endpoint (includes Cloudflare status)
app.get('/api/recordings/:id/status', (req, res) => {
    const { id } = req.params;
    const metadata = recordingsMetadata.get(id);
    
    if (!metadata) {
        return res.status(404).json({ error: 'Recording not found' });
    }
    
    res.json({
        recordingId: metadata.recordingId,
        cloudflareStatus: metadata.cloudflareStatus,
        uploadProgress: metadata.uploadProgress || 0,
        processingStatus: metadata.processingStatus,
        cloudflareReady: metadata.cloudflareReady || false,
        cloudflareVideoId: metadata.cloudflareVideoId,
        cloudflareUrls: metadata.cloudflareUrls,
        cloudflareError: metadata.cloudflareError
    });
});

// Get Cloudflare embed code
app.get('/api/recordings/:id/embed', (req, res) => {
    const { id } = req.params;
    const metadata = recordingsMetadata.get(id);
    
    if (!metadata || !metadata.cloudflareVideoId) {
        return res.status(404).json({ error: 'Recording not found or not uploaded to Cloudflare' });
    }
    
    const embedCode = cloudflareStream.generateEmbedCode(metadata.cloudflareVideoId, {
        width: req.query.width || '100%',
        height: req.query.height || '100%',
        autoplay: req.query.autoplay === 'true',
        muted: req.query.muted === 'true',
        loop: req.query.loop === 'true'
    });
    
    res.json({
        embedCode,
        videoId: metadata.cloudflareVideoId,
        embedUrl: metadata.cloudflareUrls.embed
    });
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
                    const metadata = recordingsMetadata.get(id);
                    
                    return {
                        id,
                        filename: file,
                        videoUrl: `/recordings/${file}`,
                        size: stats.size,
                        created: stats.birthtime,
                        cloudflareStatus: metadata?.cloudflareStatus || 'none',
                        cloudflareReady: metadata?.cloudflareReady || false,
                        cloudflareUrls: metadata?.cloudflareUrls || null
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