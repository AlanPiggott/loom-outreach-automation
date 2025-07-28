import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

// Default configuration
const DEFAULT_CONFIG = {
  webcamFile: 'sample.mp4',
  circleSize: 200,
  borderWidth: 2,
  borderColor: 'white',
  positionX: 20,
  positionY: 20, // from bottom
  position: 'bottom-left'
};

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(3); // Skip node, script name, and input video
  const config = { ...DEFAULT_CONFIG };
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    
    switch (key) {
      case '--output':
        config.output = value;
        break;
      case '--size':
        config.circleSize = parseInt(value);
        break;
      case '--x':
        config.positionX = parseInt(value);
        break;
      case '--y':
        config.positionY = parseInt(value);
        break;
      case '--position':
        config.position = value;
        break;
    }
  }
  
  return config;
}

async function addWebcamOverlay(inputVideo, outputVideo, CONFIG = DEFAULT_CONFIG) {
  return new Promise((resolve, reject) => {
    const webcamPath = path.join(process.cwd(), CONFIG.webcamFile);
    
    // Check if files exist
    if (!fs.existsSync(inputVideo)) {
      reject(new Error(`Input video not found: ${inputVideo}`));
      return;
    }
    
    if (!fs.existsSync(webcamPath)) {
      reject(new Error(`Webcam video not found: ${webcamPath}`));
      return;
    }
    
    console.log('🎥 Adding webcam overlay...');
    console.log(`📹 Screen recording: ${path.basename(inputVideo)}`);
    console.log(`👤 Webcam: ${path.basename(webcamPath)}`);
    console.log(`💾 Output: ${path.basename(outputVideo)}`);
    
    const radius = CONFIG.circleSize / 2;
    const radiusInner = radius - CONFIG.borderWidth;
    
    // Simplified filter complex - just the essentials
    const filterComplex = [
      // Scale webcam to square, maintaining aspect ratio
      `[1:v]scale=${CONFIG.circleSize}:${CONFIG.circleSize}:force_original_aspect_ratio=increase,` +
      `crop=${CONFIG.circleSize}:${CONFIG.circleSize},setsar=1[webcam_scaled]`,
      
      // Apply circular mask to webcam with border
      `[webcam_scaled]geq=lum='p(X,Y)':` +
      `a='if(gt(pow(X-${radius},2)+pow(Y-${radius},2),pow(${radius},2)),0,` +
      `if(gt(pow(X-${radius},2)+pow(Y-${radius},2),pow(${radiusInner},2)),255*0.8,255))'[webcam_circle]`,
      
      // Overlay webcam on main video based on position
      (() => {
        const [posV, posH] = CONFIG.position.split('-');
        let x = CONFIG.positionX;
        let y = CONFIG.positionY;
        
        if (posH === 'right') {
          x = `W-${CONFIG.circleSize + CONFIG.positionX}`;
        } else {
          x = CONFIG.positionX;
        }
        
        if (posV === 'bottom') {
          y = `H-${CONFIG.positionY + CONFIG.circleSize}`;
        } else {
          y = CONFIG.positionY;
        }
        
        return `[0:v][webcam_circle]overlay=${x}:${y}:format=auto[final]`;
      })()
    ].join(';');
    
    let duration = 0;
    let lastProgress = -1;
    
    const command = ffmpeg()
      .input(inputVideo)
      .input(webcamPath)
      .complexFilter(filterComplex)
      .outputOptions([
        '-map', '[final]',
        '-map', '0:a?', // Include audio from main video if present
        '-c:v', 'libx264',
        '-crf', '18', // High quality
        '-preset', 'medium', // Balance between speed and compression
        '-c:a', 'copy', // Copy audio without re-encoding
        '-movflags', '+faststart' // Optimize for streaming
      ])
      .output(outputVideo);
    
    // Get input duration for accurate progress
    command.ffprobe((err, data) => {
      if (!err && data && data.format && data.format.duration) {
        duration = parseFloat(data.format.duration);
      }
    });
    
    command
      .on('start', (commandLine) => {
        console.log('\n🚀 Starting FFmpeg process...');
        if (process.env.DEBUG) {
          console.log('Command:', commandLine);
        }
      })
      .on('progress', (progress) => {
        if (duration && progress.timemark) {
          // Parse timemark (format: HH:MM:SS.ms)
          const time = progress.timemark.split(':');
          const seconds = parseInt(time[0]) * 3600 + parseInt(time[1]) * 60 + parseFloat(time[2]);
          const percent = Math.min(Math.round((seconds / duration) * 100), 100);
          
          // Only log when progress changes
          if (percent !== lastProgress && percent % 10 === 0) {
            console.log(`⏳ Processing: ${percent}%`);
            lastProgress = percent;
          }
        }
      })
      .on('end', () => {
        console.log('\n✅ Webcam overlay added successfully!');
        resolve(outputVideo);
      })
      .on('error', (err, stdout, stderr) => {
        console.error('\n❌ Error:', err.message);
        if (process.env.DEBUG) {
          console.error('FFmpeg stderr:', stderr);
        }
        reject(err);
      })
      .run();
  });
}

async function findLatestRecording() {
  const recordingsDir = path.join(process.cwd(), 'recordings');
  
  if (!fs.existsSync(recordingsDir)) {
    throw new Error('Recordings directory not found');
  }
  
  const files = fs.readdirSync(recordingsDir)
    .filter(file => file.startsWith('combined-') && file.endsWith('.mp4'))
    .map(file => ({
      name: file,
      path: path.join(recordingsDir, file),
      time: fs.statSync(path.join(recordingsDir, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  if (files.length === 0) {
    throw new Error('No recordings found in recordings directory');
  }
  
  return files[0].path;
}

async function main() {
  console.log('🎬 Loom-style Webcam Overlay Tool\n');
  
  try {
    let inputVideo;
    let outputVideo;
    
    // Parse command line arguments
    const CONFIG = parseArgs();
    
    // Check if a specific file was provided as argument
    if (process.argv[2]) {
      inputVideo = process.argv[2];
      // Use provided output or generate filename
      if (CONFIG.output) {
        outputVideo = CONFIG.output;
      } else {
        const inputDir = path.dirname(inputVideo);
        const inputName = path.basename(inputVideo, '.mp4');
        outputVideo = path.join(inputDir, `final-${inputName.replace('combined-', '').replace('concatenated-', '')}.mp4`);
      }
    } else {
      // Find the latest recording
      console.log('🔍 Finding latest recording...');
      inputVideo = await findLatestRecording();
      const timestamp = path.basename(inputVideo, '.mp4').replace('combined-', '');
      outputVideo = path.join(path.dirname(inputVideo), `final-${timestamp}.mp4`);
    }
    
    // Start processing
    const startTime = Date.now();
    await addWebcamOverlay(inputVideo, outputVideo, CONFIG);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Verify output
    if (fs.existsSync(outputVideo)) {
      const stats = fs.statSync(outputVideo);
      console.log(`\n📊 Results:`);
      console.log(`📁 Output file: ${outputVideo}`);
      console.log(`📐 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`⏱️  Processing time: ${processingTime}s`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nUsage:');
    console.log('  node add-webcam-overlay.js                    # Process latest recording');
    console.log('  node add-webcam-overlay.js <video-file>       # Process specific file');
    process.exit(1);
  }
}

// Run if called directly
const __filename = fileURLToPath(import.meta.url);

if (__filename === process.argv[1]) {
  main().catch(console.error);
}

export { addWebcamOverlay, DEFAULT_CONFIG as CONFIG };