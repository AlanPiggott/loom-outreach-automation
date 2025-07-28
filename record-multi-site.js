import puppeteer from 'puppeteer-core';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

const TOKEN = process.env.BROWSERLESS_TOKEN;
const VIEWPORT = { width: 1280, height: 720 };

// Helper functions
const random = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(random(min, max + 1));

// Parse command line arguments
function parseArgs() {
    const args = process.argv.slice(2);
    const websites = [];
    
    // Look for --websites followed by JSON string
    const websitesIndex = args.indexOf('--websites');
    if (websitesIndex !== -1 && args[websitesIndex + 1]) {
        try {
            const websitesData = JSON.parse(args[websitesIndex + 1]);
            return websitesData;
        } catch (e) {
            console.error('Failed to parse websites JSON:', e);
            return [];
        }
    }
    
    return [];
}

async function recordWebsite(page, url, duration, segmentPath) {
    console.log(`🌐 Recording ${url} for ${duration}s...`);
    
    // Navigate to the page
    try {
        console.log('📡 Starting navigation...');
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000
        });
        console.log('📄 DOM loaded');
        
        // Wait for body to be available
        await page.waitForSelector('body', { timeout: 3000 });
        console.log('✓ Body element ready');
        
        // Wait for visible images
        await page.evaluate(() => {
            return new Promise((resolve) => {
                const timeout = setTimeout(resolve, 3000);
                
                const visibleImages = Array.from(document.images).filter(img => {
                    const rect = img.getBoundingClientRect();
                    return rect.top < window.innerHeight && !img.complete;
                });
                
                if (visibleImages.length === 0) {
                    clearTimeout(timeout);
                    resolve();
                    return;
                }
                
                let loadedCount = 0;
                visibleImages.forEach(img => {
                    const handler = () => {
                        loadedCount++;
                        if (loadedCount === visibleImages.length) {
                            clearTimeout(timeout);
                            resolve();
                        }
                    };
                    img.addEventListener('load', handler);
                    img.addEventListener('error', handler);
                });
            });
        });
        console.log('✓ Visible images loaded');
        
    } catch (error) {
        console.log('⚠️ Page load timeout, proceeding anyway...');
    }

    // Start recording for this segment
    const recorderConfig = {
        followNewTab: false,
        fps: 60,
        ffmpeg_Path: ffmpegPath.path,
        videoFrame: {
            width: VIEWPORT.width,
            height: VIEWPORT.height
        },
        videoCrf: 17,
        videoCodec: 'libx264',
        videoPreset: 'fast',
        videoBitrate: 4000,
        videoPixelFormat: 'yuv420p',
        aspectRatio: '16:9'
    };

    const recorder = new PuppeteerScreenRecorder(page, recorderConfig);
    await recorder.start(segmentPath);

    // Perform scrolling and mouse movements for the specified duration
    const startTime = Date.now();
    const durationMs = duration * 1000;
    let moveCount = 0;
    let lastScrollTime = Date.now();

    while (Date.now() - startTime < durationMs) {
        const progress = ((Date.now() - startTime) / durationMs) * 100;
        console.log(`⏱️ Progress: ${Math.round(progress)}%`);

        // Get current scroll position
        const currentPos = await page.evaluate(() => window.pageYOffset);
        const pageHeight = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);

        // Mouse movements
        if (moveCount < Math.ceil(duration / 3) && Math.random() < 0.4) {
            const elements = await page.evaluate(() => {
                const els = [];
                ['a', 'button', 'h1', 'h2', 'h3', 'img'].forEach(tag => {
                    document.querySelectorAll(tag).forEach(el => {
                        const rect = el.getBoundingClientRect();
                        if (rect.top >= 0 && rect.bottom <= window.innerHeight && rect.width > 50) {
                            els.push({
                                x: rect.left + rect.width / 2,
                                y: rect.top + rect.height / 2,
                                type: tag
                            });
                        }
                    });
                });
                return els.slice(0, 10);
            });

            if (elements.length > 0) {
                const target = elements[Math.floor(Math.random() * Math.min(3, elements.length))];
                const targetX = target.x + random(-15, 15);
                const targetY = target.y + random(-15, 15);
                
                await page.evaluate((x, y) => window.setCursorTarget(x, y), targetX, targetY);
                await new Promise(r => setTimeout(r, randomInt(600, 1000)));
                moveCount++;
            }
        }

        // Scrolling
        if (Date.now() - lastScrollTime > randomInt(1000, 2000)) {
            const scrollDistance = randomInt(200, 400);
            const newPos = Math.min(currentPos + scrollDistance, pageHeight);
            
            await page.evaluate((pos) => {
                window.performSmoothScroll(pos, 800);
            }, newPos);
            
            await new Promise(r => setTimeout(r, 1000));
            lastScrollTime = Date.now();
            
            // Handle bottom of page
            if (newPos >= pageHeight - 200) {
                await page.evaluate(() => {
                    window.performSmoothScroll(0, 800);
                });
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        await new Promise(r => setTimeout(r, 300));
    }

    // Stop recording
    await recorder.stop();
    await new Promise(r => setTimeout(r, 1000));
    
    console.log(`✅ Segment recorded: ${segmentPath}`);
}

async function concatenateSegments(segmentPaths, outputPath) {
    console.log('🎬 Concatenating video segments...');
    
    // Create concat list file
    const concatListPath = path.join(__dirname, 'recordings', 'concat_list.txt');
    const concatContent = segmentPaths.map(p => `file '${path.basename(p)}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);
    
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(concatListPath)
            .inputOptions(['-f', 'concat', '-safe', '0'])
            .outputOptions([
                '-c:v', 'libx264',
                '-preset', 'fast',
                '-crf', '17',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-movflags', '+faststart'
            ])
            .output(outputPath)
            .on('start', (commandLine) => {
                console.log('FFmpeg command:', commandLine);
            })
            .on('progress', (progress) => {
                if (progress.percent) {
                    console.log(`Concatenation progress: ${Math.round(progress.percent)}%`);
                }
            })
            .on('end', () => {
                console.log('✅ Videos concatenated successfully');
                // Clean up concat list
                fs.unlinkSync(concatListPath);
                resolve();
            })
            .on('error', (err) => {
                console.error('❌ Concatenation error:', err);
                reject(err);
            })
            .run();
    });
}

async function recordMultipleSites() {
    const websites = parseArgs();
    
    if (!websites || websites.length === 0) {
        console.error('❌ No websites provided. Use --websites \'[{"url":"...", "duration":30}]\'');
        process.exit(1);
    }

    let browser;
    const segmentPaths = [];
    const timestamp = Date.now();

    try {
        console.log('🚀 Starting Multi-Site Recording...');
        console.log(`📋 Recording ${websites.length} websites`);
        
        const wsUrl = `wss://production-sfo.browserless.io?token=${TOKEN}`;
        
        browser = await puppeteer.connect({
            browserWSEndpoint: wsUrl,
            defaultViewport: VIEWPORT
        });

        const page = await browser.newPage();
        await page.setViewport({
            width: VIEWPORT.width,
            height: VIEWPORT.height,
            deviceScaleFactor: 1
        });

        // Inject cursor and smooth scrolling (same as record-combined.js)
        await page.evaluateOnNewDocument(() => {
            // Create styles
            const style = document.createElement('style');
            style.textContent = `
                #natural-cursor {
                    position: fixed;
                    width: 24px;
                    height: 24px;
                    z-index: 2147483647;
                    pointer-events: none;
                    margin-left: -2px;
                    margin-top: -2px;
                    transition: none;
                }
            `;
            document.addEventListener('DOMContentLoaded', () => {
                document.head.appendChild(style);
                
                // Create cursor element
                const cursor = document.createElement('div');
                cursor.id = 'natural-cursor';
                cursor.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" style="filter: drop-shadow(1px 2px 3px rgba(0,0,0,0.4));">
                        <path d="M0 0 L0 20 L5.5 15.5 L9 22 L12 20.5 L8.5 14 L16 14 Z" 
                              fill="white" 
                              stroke="black" 
                              stroke-width="1"
                              stroke-linejoin="round"/>
                    </svg>
                `;
                document.body.appendChild(cursor);
                
                // Initialize cursor state and animation
                window.cursorPos = { x: 640, y: 360, targetX: 640, targetY: 360 };
                
                window.animateCursor = () => {
                    const cursor = document.getElementById('natural-cursor');
                    if (!cursor) return;
                    
                    // Smooth interpolation
                    const ease = 0.15;
                    window.cursorPos.x += (window.cursorPos.targetX - window.cursorPos.x) * ease;
                    window.cursorPos.y += (window.cursorPos.targetY - window.cursorPos.y) * ease;
                    
                    cursor.style.left = window.cursorPos.x + 'px';
                    cursor.style.top = window.cursorPos.y + 'px';
                    
                    requestAnimationFrame(window.animateCursor);
                };
                
                // Start animation immediately
                requestAnimationFrame(window.animateCursor);
                
                // Function to set target position
                window.setCursorTarget = (x, y) => {
                    window.cursorPos.targetX = x;
                    window.cursorPos.targetY = y;
                };
                
                // Initialize smooth scrolling
                window.smoothScrollState = {
                    targetY: 0,
                    currentY: window.pageYOffset,
                    velocity: 0,
                    isScrolling: false
                };

                // Physics-based smooth scrolling
                window.performSmoothScroll = (targetY, duration = 1000) => {
                    const state = window.smoothScrollState;
                    state.targetY = targetY;
                    state.isScrolling = true;
                    
                    const startY = window.pageYOffset;
                    const distance = targetY - startY;
                    const startTime = performance.now();
                    
                    const animate = (currentTime) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        
                        // Smooth easing function
                        const easeInOutCubic = t => t < 0.5 
                            ? 4 * t * t * t 
                            : 1 - Math.pow(-2 * t + 2, 3) / 2;
                        
                        const easedProgress = easeInOutCubic(progress);
                        const currentY = startY + (distance * easedProgress);
                        
                        window.scrollTo(0, currentY);
                        
                        if (progress < 1) {
                            requestAnimationFrame(animate);
                        } else {
                            state.isScrolling = false;
                            state.currentY = targetY;
                        }
                    };
                    
                    requestAnimationFrame(animate);
                };
            });
        });

        // Ensure recordings directory exists
        const outputDir = path.join(__dirname, 'recordings');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Record each website
        for (let i = 0; i < websites.length; i++) {
            const website = websites[i];
            const segmentPath = path.join(outputDir, `segment-${timestamp}-${i}.mp4`);
            segmentPaths.push(segmentPath);
            
            console.log(`\n📹 Recording website ${i + 1}/${websites.length}`);
            await recordWebsite(page, website.url, website.duration, segmentPath);
        }

        await browser.close();
        browser = null;

        // Concatenate all segments
        const concatenatedPath = path.join(outputDir, `concatenated-${timestamp}.mp4`);
        await concatenateSegments(segmentPaths, concatenatedPath);

        // Clean up segment files
        for (const segmentPath of segmentPaths) {
            fs.unlinkSync(segmentPath);
        }

        console.log(`✅ Multi-site recording complete: ${concatenatedPath}`);
        
        // Return the path for the next step (adding webcam overlay)
        return concatenatedPath;

    } catch (error) {
        console.error('❌ Error during recording:', error);
        process.exit(1);
    } finally {
        if (browser) {
            console.log('🔚 Closing browser...');
            await browser.close();
        }
    }
}

// Run the multi-site recording
if (process.argv[1] === __filename) {
    recordMultipleSites().then(outputPath => {
        // Output the path for the parent process to use
        console.log(`OUTPUT_PATH:${outputPath}`);
    }).catch(console.error);
}