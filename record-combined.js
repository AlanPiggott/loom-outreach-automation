import puppeteer from 'puppeteer-core';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

const TOKEN = process.env.BROWSERLESS_TOKEN;
const VIEWPORT = { width: 1280, height: 720 };
const URL = 'https://webtrixdigital.com/';
const RECORDING_DURATION = 10000; // 10 seconds

// Helper functions
const random = (min, max) => Math.random() * (max - min) + min;
const randomInt = (min, max) => Math.floor(random(min, max + 1));

async function recordCombined() {
  let browser;
  let recorder;

  try {
    console.log('🚀 Starting Combined Recording with Natural Mouse & Smooth Scrolling...');
    
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

    // Inject cursor and animation BEFORE navigation
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
        
        // FPS monitoring
        window.performanceData = {
          fps: 0,
          frameCount: 0,
          lastTime: performance.now()
        };

        const updateFPS = () => {
          const now = performance.now();
          const delta = now - window.performanceData.lastTime;
          
          if (delta >= 1000) {
            window.performanceData.fps = Math.round((window.performanceData.frameCount * 1000) / delta);
            window.performanceData.frameCount = 0;
            window.performanceData.lastTime = now;
          }
          
          window.performanceData.frameCount++;
          requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
      });
    });

    console.log('🔄 Preloading website...');
    const preloadStartTime = Date.now();
    
    // Navigate to the page BEFORE starting recording
    try {
      console.log('📡 Starting navigation...');
      await page.goto(URL, { 
        waitUntil: 'domcontentloaded', // Changed from networkidle2 for faster load
        timeout: 10000
      });
      console.log('📄 DOM loaded');
      
      // Wait for body to be available
      await page.waitForSelector('body', { timeout: 3000 });
      console.log('✓ Body element ready');
      
      // Wait for visible images only (with timeout)
      await page.evaluate(() => {
        return new Promise((resolve) => {
          const timeout = setTimeout(resolve, 3000); // 3 second max wait for images
          
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
      
      const loadTime = Date.now() - preloadStartTime;
      console.log(`✅ Site ready in ${(loadTime / 1000).toFixed(1)} seconds`);
      
    } catch (error) {
      console.log('⚠️ Preload timeout, proceeding anyway...');
    }

    // Optimized recorder config for 60fps
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

    const outputDir = path.join(process.cwd(), 'recordings');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `combined-${Date.now()}.mp4`);
    recorder = new PuppeteerScreenRecorder(page, recorderConfig);

    console.log('📹 Starting 60fps recording...');
    await recorder.start(outputPath);

    // Just a short wait before starting the scroll sequence
    await new Promise(r => setTimeout(r, 500));

    console.log('⬇️ Initial scroll down...');
    // Scroll down half a viewport height
    const scrollDistance = VIEWPORT.height / 2;
    
    // Scroll down half a section
    await page.evaluate((distance) => {
      window.performSmoothScroll(distance, 1000);
    }, scrollDistance);
    await new Promise(r => setTimeout(r, 1200));
    
    console.log('⬆️ Scrolling back up...');
    // Scroll back to top
    await page.evaluate(() => {
      window.performSmoothScroll(0, 1000);
    });
    await new Promise(r => setTimeout(r, 1200));

    console.log('🎬 Beginning synchronized mouse & scroll movements...');
    
    const startTime = Date.now();
    let mode = 'search';
    let lastModeChange = Date.now();
    let moveCount = 0;
    let lastScrollTime = Date.now();

    // Main animation loop
    while (Date.now() - startTime < RECORDING_DURATION) {
      // Change modes periodically
      if (Date.now() - lastModeChange > randomInt(3000, 4000)) {
        mode = ['search', 'read', 'skim'][randomInt(0, 2)];
        lastModeChange = Date.now();
        console.log(`🔄 Mode: ${mode}`);
      }

      // Get current scroll position
      const currentPos = await page.evaluate(() => window.pageYOffset);
      const pageHeight = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);

      // Synchronized mouse movements (3-4 times during recording)
      if (moveCount < 4 && Math.random() < 0.4) {
        // Find elements to interact with
        const elements = await page.evaluate(() => {
          const els = [];
          ['a', 'button', 'h1', 'h2', 'h3', 'img', '[role="button"]'].forEach(tag => {
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
          // Move based on current mode
          if (mode === 'search' && elements.length > 0) {
            // Quick movements to different elements
            const target = elements[Math.floor(Math.random() * Math.min(3, elements.length))];
            console.log(`👀 Looking at ${target.type} element`);
            
            const targetX = target.x + random(-15, 15);
            const targetY = target.y + random(-15, 15);
            
            await page.evaluate((x, y) => window.setCursorTarget(x, y), targetX, targetY);
            await new Promise(r => setTimeout(r, randomInt(600, 1000)));
            
            // Hover pause
            await new Promise(r => setTimeout(r, randomInt(800, 1500)));
            
          } else if (mode === 'read') {
            // Slower, reading-like movements
            const currentCursor = await page.evaluate(() => window.cursorPos);
            const readX = Math.min(currentCursor.x + random(50, 150), VIEWPORT.width - 100);
            const readY = currentCursor.y + random(10, 40);
            
            await page.evaluate((x, y) => window.setCursorTarget(x, y), readX, readY);
            await new Promise(r => setTimeout(r, randomInt(1000, 1500)));
            
          } else {
            // Skimming - broader movements
            const skimX = randomInt(200, VIEWPORT.width - 200);
            const skimY = randomInt(150, VIEWPORT.height - 150);
            
            await page.evaluate((x, y) => window.setCursorTarget(x, y), skimX, skimY);
            await new Promise(r => setTimeout(r, randomInt(700, 1200)));
          }
          
          moveCount++;
        }
      }

      // Synchronized scrolling
      if (Date.now() - lastScrollTime > randomInt(800, 1500)) {
        // Move cursor to indicate scrolling intention
        if (Math.random() < 0.3) {
          const scrollPrepX = random(VIEWPORT.width * 0.6, VIEWPORT.width * 0.9);
          const scrollPrepY = random(VIEWPORT.height * 0.4, VIEWPORT.height * 0.7);
          
          await page.evaluate((x, y) => window.setCursorTarget(x, y), scrollPrepX, scrollPrepY);
          await new Promise(r => setTimeout(r, 400));
        }

        // Scroll based on mode
        switch (mode) {
          case 'search':
            const searchDistance = randomInt(300, 500);
            await page.evaluate((distance) => {
              window.performSmoothScroll(window.pageYOffset + distance, 500);
            }, searchDistance);
            await new Promise(r => setTimeout(r, 600));
            break;

          case 'read':
            const readDistance = randomInt(100, 200);
            await page.evaluate((distance) => {
              window.performSmoothScroll(window.pageYOffset + distance, 1200);
            }, readDistance);
            await new Promise(r => setTimeout(r, 1500));
            break;

          case 'skim':
            const skimDistance = randomInt(250, 400);
            await page.evaluate((distance) => {
              window.performSmoothScroll(window.pageYOffset + distance, 700);
            }, skimDistance);
            await new Promise(r => setTimeout(r, 800));
            break;
        }
        
        lastScrollTime = Date.now();
      }

      // Small pause between actions
      await new Promise(r => setTimeout(r, 300));
      
      // Handle bottom of page
      if (currentPos >= pageHeight - 200) {
        console.log('📍 Near bottom, scrolling back up...');
        await page.evaluate(() => {
          window.performSmoothScroll(Math.max(0, window.pageYOffset - 1000), 800);
        });
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // End sequence
    console.log('🏁 Ending recording...');
    
    // Move cursor to center
    await page.evaluate(() => window.setCursorTarget(640, 360));
    await new Promise(r => setTimeout(r, 500));
    
    // Smooth scroll to top
    await page.evaluate(() => {
      window.performSmoothScroll(0, 1500);
    });
    await new Promise(r => setTimeout(r, 2000));

    // Get performance stats
    const fps = await page.evaluate(() => window.performanceData.fps);
    console.log(`📊 Final FPS: ${fps}`);

    console.log('💾 Stopping recording...');
    await recorder.stop();
    
    // Wait to ensure file is written
    await new Promise(r => setTimeout(r, 1000));

    console.log(`✅ Recording saved to: ${outputPath}`);
    
    // Verify file
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      console.log(`📁 File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    }

  } catch (error) {
    console.error('❌ Error during recording:', error);
    if (recorder) {
      try {
        await recorder.stop();
        await new Promise(r => setTimeout(r, 1000));
      } catch (stopError) {
        console.error('Error stopping recorder:', stopError);
      }
    }
  } finally {
    if (browser) {
      console.log('🔚 Closing browser...');
      await browser.close();
    }
  }
}

// Run the combined recording
recordCombined().catch(console.error);