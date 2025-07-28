import fs from 'fs';
import puppeteer from 'puppeteer-core';
import 'dotenv/config';

const TOKEN = process.env.BROWSERLESS_TOKEN;
const URL = 'https://example.com';
const VIEWPORT = { width: 1280, height: 720 };

// Build WebSocket endpoint WITHOUT recording (not supported on Prototyping plan)
const wsEndpoint = `wss://production-sfo.browserless.io/?token=${TOKEN}`;

console.log('Connecting to Browserless (Prototyping plan)...');

(async () => {
  try {
    const browser = await puppeteer.connect({ browserWSEndpoint: wsEndpoint });
    console.log('✅ Connected successfully!');
    
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);
    
    console.log(`Navigating to ${URL}...`);
    await page.goto(URL, { waitUntil: 'load' });
    console.log('✅ Page loaded!');
    
    // Take a screenshot instead of recording
    console.log('Taking screenshot...');
    const screenshot = await page.screenshot({ fullPage: true });
    await fs.promises.writeFile('./screenshot.png', screenshot);
    console.log('✅ Screenshot saved as screenshot.png');
    
    // Perform smooth scrolling (even though we can't record it)
    console.log('Performing smooth scroll...');
    await page.evaluate(async () => {
      const distance = 400;
      const delay = 300;
      const duration = 10000; // 10 seconds
      const start = Date.now();
      
      while (Date.now() - start < duration) {
        window.scrollBy(0, distance);
        await new Promise(r => setTimeout(r, delay));
      }
    });
    console.log('✅ Scrolling complete!');
    
    // Take another screenshot after scrolling
    const screenshotAfter = await page.screenshot({ fullPage: true });
    await fs.promises.writeFile('./screenshot-after-scroll.png', screenshotAfter);
    console.log('✅ Post-scroll screenshot saved!');
    
    await browser.close();
    console.log('✅ Browser closed successfully!');
    
    console.log('\n⚠️  Note: Video recording requires Scale or Enterprise plan.');
    console.log('   On Prototyping plan, you can only take screenshots.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();