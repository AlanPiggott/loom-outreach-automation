# Multi-Website Recording Feature

This feature allows you to record multiple websites in sequence and combine them into a single video with a continuous webcam overlay, just like Loom.

## How It Works

1. **Sequential Recording**: Each website is recorded for its specified duration
2. **Seamless Transitions**: Videos are concatenated together smoothly
3. **Continuous Webcam**: The webcam overlay appears throughout the entire video
4. **Customizable Durations**: Each website can have a different recording duration

## Usage

### Via Web Interface

1. Start the web server:
   ```bash
   npm start
   ```

2. Open http://localhost:3000 in your browser

3. Upload your webcam video (or use the default sample.mp4)

4. Add multiple websites:
   - Click "Add Website" to add more website entries
   - Enter the URL for each website
   - Set the duration for each website (5-60 seconds)
   - Use the up/down arrows to reorder websites
   - Click the X to remove a website

5. Configure the webcam overlay settings:
   - Adjust the webcam circle size
   - Choose the overlay position (4 corners)

6. Click "Start Recording" to begin

7. The system will:
   - Record each website for its specified duration
   - Show progress for each website
   - Concatenate all recordings
   - Apply the webcam overlay
   - Provide a preview and download link

### Via Command Line

For advanced users, you can use the command line scripts directly:

```bash
# Record multiple websites with webcam overlay
node record-multi-webcam.js \
  --websites '[{"url":"https://example.com","duration":20},{"url":"https://google.com","duration":10}]' \
  --size 200 \
  --position bottom-left \
  --recordingId 123456
```

## Architecture

The multi-website recording feature consists of several components:

1. **Frontend (app.js)**:
   - Dynamic website list management
   - Duration controls for each website
   - Real-time progress updates

2. **Backend (server.js)**:
   - Updated `/api/record` endpoint to accept website arrays
   - Spawns the multi-recording process

3. **Recording Scripts**:
   - `record-multi-site.js`: Records each website sequentially
   - `record-multi-webcam.js`: Orchestrates the full process
   - `add-webcam-overlay.js`: Applies webcam overlay to final video

4. **FFmpeg Processing**:
   - Uses concat demuxer to join video segments
   - Maintains video quality throughout the process
   - Applies circular webcam overlay with customizable position

## Example Workflow

1. User adds 3 websites:
   - https://mycompany.com (30 seconds)
   - https://ourproduct.com (20 seconds)
   - https://testimonials.com (10 seconds)

2. Total recording time: 60 seconds

3. The system records each site with natural scrolling and mouse movements

4. All segments are concatenated into one video

5. Webcam overlay is applied to the entire 60-second video

6. User gets a single video file showing all three websites with their face in the corner

## Tips

- Keep individual website durations reasonable (5-60 seconds)
- Test with shorter durations first
- Ensure all URLs are valid and accessible
- The webcam video loops if the recording is longer than the webcam video

## Troubleshooting

### "No websites added"
Make sure at least one website has a valid URL starting with http:// or https://

### "Recording failed"
Check the browser console and server logs for specific errors. Common issues:
- Invalid URLs
- Browserless token issues
- Insufficient disk space

### "Concatenation failed"
This usually means one of the segment recordings failed. Check that all websites are accessible.

## Technical Details

- Videos are recorded at 60fps for smooth playback
- Each segment is saved temporarily as `segment-{timestamp}-{index}.mp4`
- Segments are concatenated using FFmpeg's concat demuxer
- The webcam overlay is applied to the final concatenated video
- All temporary files are cleaned up after processing