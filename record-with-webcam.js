import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  recordingDuration: process.env.RECORDING_DURATION || 10000, // Default 10 seconds
  webcamFile: process.env.WEBCAM_FILE || 'sample.mp4',
  autoDelete: process.env.AUTO_DELETE_COMBINED === 'true' // Delete intermediate file
};

function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 Running: ${path.basename(scriptPath)}`);
    
    const child = spawn('node', [scriptPath, ...args], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Script exited with code ${code}`));
      } else {
        resolve();
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function findLatestRecording() {
  const recordingsDir = path.join(__dirname, 'recordings');
  
  const files = fs.readdirSync(recordingsDir)
    .filter(file => file.startsWith('combined-') && file.endsWith('.mp4'))
    .map(file => ({
      name: file,
      path: path.join(recordingsDir, file),
      time: fs.statSync(path.join(recordingsDir, file)).mtime.getTime()
    }))
    .sort((a, b) => b.time - a.time);
  
  return files[0]?.path;
}

async function main() {
  try {
    console.log('🎬 Loom-style Recording with Webcam Overlay');
    console.log('==========================================\n');
    
    // Check webcam file exists
    const webcamPath = path.join(__dirname, CONFIG.webcamFile);
    if (!fs.existsSync(webcamPath)) {
      throw new Error(`Webcam file not found: ${CONFIG.webcamFile}`);
    }
    console.log(`✅ Webcam file found: ${CONFIG.webcamFile}`);
    
    // Step 1: Record the website
    console.log('\n📹 Step 1: Recording website...');
    await runScript(path.join(__dirname, 'record-combined.js'));
    
    // Find the recording that was just created
    const recordingPath = await findLatestRecording();
    if (!recordingPath) {
      throw new Error('No recording found after recording step');
    }
    console.log(`✅ Recording created: ${path.basename(recordingPath)}`);
    
    // Step 2: Add webcam overlay
    console.log('\n🎥 Step 2: Adding webcam overlay...');
    await runScript(path.join(__dirname, 'add-webcam-overlay.js'), [recordingPath]);
    
    // Find the final output
    const finalPath = recordingPath.replace('combined-', 'final-');
    if (fs.existsSync(finalPath)) {
      console.log(`\n✅ Final video created: ${path.basename(finalPath)}`);
      
      // Optionally delete intermediate file
      if (CONFIG.autoDelete) {
        fs.unlinkSync(recordingPath);
        console.log(`🗑️  Deleted intermediate file: ${path.basename(recordingPath)}`);
      }
      
      // Show final stats
      const stats = fs.statSync(finalPath);
      console.log('\n📊 Final Results:');
      console.log(`📁 Location: ${finalPath}`);
      console.log(`📐 Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`🎞️  Duration: ~${CONFIG.recordingDuration / 1000} seconds`);
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (__filename === process.argv[1]) {
  main().catch(console.error);
}