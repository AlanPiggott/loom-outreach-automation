import fetch from 'node-fetch';
import puppeteer from 'puppeteer-core';

const BROWSERLESS_TOKEN = '2SkrcAB0hpbiHZh9422ae56a39bb35cd24009ee8d1542bdce';

async function testBrowserlessConnection() {
  console.log('Testing Browserless connection...\n');

  // Test 1: Check token validity with a simple API call
  console.log('Test 1: Checking token validity...');
  try {
    const response = await fetch('https://chrome.browserless.io/stats', {
      headers: {
        'Authorization': `Bearer ${BROWSERLESS_TOKEN}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✓ Token is valid! Stats:', JSON.stringify(data, null, 2));
    } else {
      console.log(`✗ Token validation failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
  } catch (error) {
    console.log('✗ Failed to check token:', error.message);
  }

  console.log('\n---\n');

  // Test 2: Try different WebSocket connection formats
  console.log('Test 2: Testing WebSocket connections...');
  const wsFormats = [
    `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`,
    `wss://chrome.browserless.io/?token=${BROWSERLESS_TOKEN}`,
    `wss://production-sfo.browserless.io?token=${BROWSERLESS_TOKEN}`,
    `wss://chrome.browserless.io/chromium?token=${BROWSERLESS_TOKEN}`,
  ];

  for (const wsUrl of wsFormats) {
    console.log(`\nTrying: ${wsUrl}`);
    try {
      const browser = await puppeteer.connect({
        browserWSEndpoint: wsUrl,
      });
      console.log('✓ Successfully connected!');
      await browser.close();
      break;
    } catch (error) {
      console.log(`✗ Failed: ${error.message}`);
    }
  }

  console.log('\n---\n');

  // Test 3: Try REST API approach
  console.log('Test 3: Testing REST API browser creation...');
  try {
    const response = await fetch('https://chrome.browserless.io/chromium', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BROWSERLESS_TOKEN}`
      },
      body: JSON.stringify({
        headless: true,
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✓ REST API request successful!');
      console.log('Response:', JSON.stringify(data, null, 2));
      
      if (data.webSocketDebuggerUrl || data.wsEndpoint) {
        const wsEndpoint = data.webSocketDebuggerUrl || data.wsEndpoint;
        console.log('\nTrying to connect to returned WebSocket...');
        try {
          const browser = await puppeteer.connect({
            browserWSEndpoint: wsEndpoint,
          });
          console.log('✓ Successfully connected to browser!');
          await browser.close();
        } catch (error) {
          console.log(`✗ Failed to connect: ${error.message}`);
        }
      }
    } else {
      console.log(`✗ REST API request failed: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error response:', errorText);
    }
  } catch (error) {
    console.log('✗ Failed REST API test:', error.message);
  }

  console.log('\n---\n');

  // Test 4: Check available endpoints
  console.log('Test 4: Checking available endpoints...');
  const endpoints = [
    'https://chrome.browserless.io',
    'https://chrome.browserless.io/json/version',
    'https://chrome.browserless.io/health',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${BROWSERLESS_TOKEN}`
        }
      });
      console.log(`${endpoint}: ${response.status} ${response.statusText}`);
    } catch (error) {
      console.log(`${endpoint}: Failed - ${error.message}`);
    }
  }
}

// Run the tests
testBrowserlessConnection().catch(console.error);