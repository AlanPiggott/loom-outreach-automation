# Loom-Style Webcam Overlay

This feature adds a circular webcam overlay to your screen recordings, creating professional Loom-style videos with the speaker visible in the bottom-left corner.

## Features

- **Circular webcam overlay** - Webcam video appears in a perfect circle
- **Professional styling** - White border with subtle transparency
- **Maintains aspect ratio** - Webcam content is center-cropped to fill the circle
- **High quality output** - 60fps recording with optimized encoding
- **Automated workflow** - Single command to record and add overlay

## Quick Start

### 1. Basic Usage (Integrated Workflow)

Record a website with webcam overlay in one command:

```bash
node record-with-webcam.js
```

This will:
1. Record the website using `record-combined.js`
2. Automatically add the webcam overlay from `sample.mp4`
3. Save the final video to `recordings/final-[timestamp].mp4`

### 2. Manual Workflow

If you want more control over the process:

```bash
# Step 1: Record the website
node record-combined.js

# Step 2: Add webcam overlay to the latest recording
node add-webcam-overlay.js

# Or specify a specific recording
node add-webcam-overlay.js recordings/combined-1234567890.mp4
```

## Configuration

### Recording Duration

Set the recording duration (in milliseconds):

```bash
RECORDING_DURATION=20000 node record-with-webcam.js  # 20 seconds
```

### Webcam File

Use a different webcam video:

```bash
WEBCAM_FILE=my-webcam.mp4 node record-with-webcam.js
```

### Circle Size and Position

Edit `add-webcam-overlay.js` to customize:

```javascript
const CONFIG = {
  webcamFile: 'sample.mp4',
  circleSize: 200,        // Circle diameter in pixels
  borderWidth: 2,         // Border thickness
  borderColor: 'white',   // Border color
  positionX: 20,          // Distance from left edge
  positionY: 20,          // Distance from bottom edge
};
```

### Auto-delete Intermediate Files

To save disk space, automatically delete the intermediate recording:

```bash
AUTO_DELETE_COMBINED=true node record-with-webcam.js
```

## File Structure

```
├── record-combined.js       # Screen recording script
├── add-webcam-overlay.js    # Webcam overlay processor
├── record-with-webcam.js    # Integrated workflow script
├── sample.mp4              # Your webcam video
└── recordings/
    ├── combined-*.mp4      # Original screen recordings
    └── final-*.mp4         # Final videos with overlay
```

## Requirements

- Node.js with ES modules support
- FFmpeg (installed automatically via @ffmpeg-installer)
- Browserless.io token (for screen recording)

## Tips

1. **Webcam Recording**: Record your webcam video separately using any tool (QuickTime, OBS, etc.)
2. **Aspect Ratio**: The webcam video will be center-cropped to a square, so frame yourself accordingly
3. **File Size**: Use reasonable quality settings for your webcam video to keep file sizes manageable
4. **Performance**: Processing time is typically 10-15% of the video duration

## Troubleshooting

### "Webcam file not found"
- Ensure `sample.mp4` exists in the project root
- Or specify a different file: `WEBCAM_FILE=path/to/video.mp4`

### "FFmpeg error"
- Check that your webcam video is a valid MP4 file
- Try re-encoding problematic videos: `ffmpeg -i input.mp4 -c:v libx264 -c:a aac output.mp4`

### Large output files
- Adjust the CRF value in `add-webcam-overlay.js` (higher = smaller file, lower quality)
- Current setting: `-crf 18` (high quality)

## Examples

### Record a 30-second demo with webcam
```bash
RECORDING_DURATION=30000 node record-with-webcam.js
```

### Use a custom webcam video
```bash
WEBCAM_FILE=intro-video.mp4 node record-with-webcam.js
```

### Process an existing recording
```bash
node add-webcam-overlay.js recordings/combined-1234567890.mp4
```