import puppeteer from 'puppeteer-core';
import 'dotenv/config';

const TOKEN = process.env.BROWSERLESS_TOKEN;

// Test basic connection without recording
const basicEndpoint = `wss://chrome.browserless.io?token=${TOKEN}`;

console.log('Testing basic connection...');
console.log('Token:', TOKEN ? `${TOKEN.substring(0, 10)}...` : 'NOT LOADED');

try {
  const browser = await puppeteer.connect({ browserWSEndpoint: basicEndpoint });
  console.log('✅ Basic connection successful!');
  
  const page = await browser.newPage();
  await page.goto('https://example.com');
  console.log('✅ Page navigation successful!');
  
  await browser.close();
  console.log('✅ Browser closed successfully!');
} catch (error) {
  console.error('❌ Connection failed:', error.message);
}