# Headless Recording with Puppeteer Screen Recorder

This implementation demonstrates how to record browser sessions using `puppeteer-screen-recorder` with Browserless.io, without requiring the `record=true` parameter (which isn't available on the Prototyping plan).

## Setup

1. Install dependencies:
```bash
npm install puppeteer-screen-recorder fluent-ffmpeg @ffmpeg-installer/ffmpeg puppeteer-core
```

2. Update the `BROWSERLESS_TOKEN` in the scripts with your token.

## Files

- `record-headless.js` - Basic recording example that scrolls through example.com
- `record-advanced-example.js` - Advanced example with multiple pages and interactions
- `test-browserless-connection.js` - Diagnostic script to test Browserless connectivity

## Usage

Run the basic recording:
```bash
node record-headless.js
```

Run the advanced recording:
```bash
node record-advanced-example.js
```

## Key Features

1. **Works with Browserless Prototyping Plan** - Uses `puppeteer-screen-recorder` to capture screenshots and stitch them into video locally
2. **Headless Recording** - Runs completely headless on Browserless servers
3. **Configurable Quality** - Adjust FPS, resolution, bitrate, and codec settings
4. **Error Handling** - Proper cleanup and error messages
5. **Multiple Recording Scenarios** - Supports scrolling, navigation, interactions, and more

## Important Notes

- Uses `wss://production-sfo.browserless.io` endpoint (not the standard chrome.browserless.io)
- Records are saved to the `recordings/` directory
- Each recording is timestamped to avoid conflicts
- The recording quality can be adjusted in the Config object

## Recording Configuration

```javascript
const Config = {
  fps: 25,                    // Frames per second
  videoFrame: {
    width: 1280,
    height: 720,
  },
  videoCrf: 18,              // Quality (lower = better, 0-51)
  videoCodec: 'libx264',     // Video codec
  videoPreset: 'ultrafast',  // Encoding speed/quality tradeoff
  videoBitrate: 1000,        // Bitrate in kbps
};
```

## Troubleshooting

1. If connection fails, run `test-browserless-connection.js` to diagnose
2. Ensure your Browserless token is valid and has available credits
3. Check that ffmpeg is properly installed via the @ffmpeg-installer package