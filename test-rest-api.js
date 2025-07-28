import fetch from 'node-fetch';
import 'dotenv/config';

const TOKEN = process.env.BROWSERLESS_TOKEN;

// Test with screenshot API (a common REST endpoint)
const testScreenshot = async () => {
  const url = `https://production-sfo.browserless.io/screenshot?token=${TOKEN}`;
  
  console.log('Testing REST API with screenshot endpoint...');
  console.log('Token:', TOKEN ? `${TOKEN.substring(0, 10)}...` : 'NOT LOADED');
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://example.com',
        options: {
          fullPage: false,
          type: 'png'
        }
      })
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Token is valid! Screenshot API works.');
      const buffer = await response.buffer();
      console.log(`Screenshot size: ${buffer.length} bytes`);
    } else {
      const text = await response.text();
      console.log('❌ Error:', text);
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
  }
};

testScreenshot();