import fetch from 'node-fetch';
import 'dotenv/config';

const TOKEN = process.env.BROWSERLESS_TOKEN;

// Test token with different endpoints
const endpoints = [
  'https://production-sfo.browserless.io/pressure',
  'https://production-lon.browserless.io/pressure',
  'https://production-ams.browserless.io/pressure'
];

console.log('Testing token:', TOKEN ? `${TOKEN.substring(0, 10)}...` : 'NOT LOADED');
console.log('---');

for (const endpoint of endpoints) {
  const url = `${endpoint}?token=${TOKEN}`;
  console.log(`Testing ${endpoint.split('.')[0].split('//')[1]}...`);
  
  try {
    const response = await fetch(url);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success:', data);
    } else {
      const text = await response.text();
      console.log('❌ Error:', text);
    }
  } catch (error) {
    console.log('❌ Connection error:', error.message);
  }
  console.log('---');
}