import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const params = {
        websites: [],
        size: '200',
        position: 'bottom-right',
        recordingId: Date.now().toString()
    };
    
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        
        switch (key) {
            case '--websites':
                try {
                    params.websites = JSON.parse(value);
                } catch (e) {
                    console.error('Failed to parse websites JSON:', e);
                }
                break;
            case '--size':
                params.size = value;
                break;
            case '--position':
                params.position = value;
                break;
            case '--recordingId':
                params.recordingId = value;
                break;
        }
    }
    
    return params;
}

async function runScript(scriptPath, args = []) {
    return new Promise((resolve, reject) => {
        const process = spawn('node', [scriptPath, ...args]);
        let output = '';
        let errorOutput = '';
        
        process.stdout.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log(text.trim());
        });
        
        process.stderr.on('data', (data) => {
            const text = data.toString();
            errorOutput += text;
            console.error(text.trim());
        });
        
        process.on('close', (code) => {
            if (code === 0) {
                // Extract output path if present
                const outputMatch = output.match(/OUTPUT_PATH:(.+)/);
                if (outputMatch) {
                    resolve(outputMatch[1].trim());
                } else {
                    resolve(output);
                }
            } else {
                reject(new Error(`Script failed with code ${code}: ${errorOutput}`));
            }
        });
    });
}

async function main() {
    const params = parseArgs();
    
    if (!params.websites || params.websites.length === 0) {
        console.error('❌ No websites provided');
        process.exit(1);
    }
    
    try {
        console.log('🎬 Starting multi-site recording with webcam overlay...');
        console.log(`📋 Recording ${params.websites.length} websites`);
        
        // Step 1: Record multiple websites
        console.log('\n📹 Step 1: Recording websites...');
        const concatenatedPath = await runScript(
            path.join(__dirname, 'record-multi-site.js'),
            ['--websites', JSON.stringify(params.websites)]
        );
        
        if (!concatenatedPath || !fs.existsSync(concatenatedPath)) {
            throw new Error('Multi-site recording failed - no output file');
        }
        
        // Step 2: Add webcam overlay to the concatenated video
        console.log('\n🎥 Step 2: Adding webcam overlay...');
        
        // Parse position
        const [posX, posY] = params.position.split('-');
        let positionX = 30;
        let positionY = 30;
        
        if (posX === 'bottom') {
            positionY = 30; // Will be calculated from bottom in add-webcam-overlay
        }
        if (posY === 'right') {
            positionX = 30; // Will be calculated from right in add-webcam-overlay
        }
        
        const finalPath = path.join(__dirname, 'recordings', `final-${params.recordingId}.mp4`);
        
        await runScript(
            path.join(__dirname, 'add-webcam-overlay.js'),
            [
                concatenatedPath,
                '--output', finalPath,
                '--size', params.size,
                '--x', positionX.toString(),
                '--y', positionY.toString(),
                '--position', params.position
            ]
        );
        
        // Clean up concatenated file
        if (fs.existsSync(concatenatedPath)) {
            fs.unlinkSync(concatenatedPath);
        }
        
        console.log(`\n✅ Multi-site recording with webcam overlay complete!`);
        console.log(`📁 Final video: ${finalPath}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);