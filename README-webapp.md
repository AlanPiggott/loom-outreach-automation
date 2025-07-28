# Loom-Style Video Recorder Web Application

A modern, dark-themed web application that provides a user-friendly interface for creating Loom-style recordings with webcam overlays.

## Features

- **📹 Custom Webcam Upload**: Upload your own MP4 video to use as the webcam overlay
- **🌐 Custom URL Recording**: Enter any URL to record instead of the default
- **⚙️ Configurable Settings**: 
  - Recording duration (5-60 seconds)
  - Webcam circle size (150-300px)
  - Overlay position (4 corner options)
- **📊 Real-time Progress**: Live status updates during recording and processing
- **🎬 Video Preview**: Watch recordings directly in the browser with built-in player
- **💾 Download Management**: View and download all completed recordings

## Getting Started

### 1. Install Dependencies

If you haven't already installed the dependencies:

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

### 3. Open the Application

Open your web browser and navigate to:
```
http://localhost:3000
```

## How to Use

### Step 1: Upload Your Webcam Video
1. Click the "Upload Webcam Video" button
2. Select an MP4 file from your computer
3. The file will be uploaded and displayed with its size

### Step 2: Configure Recording Settings
1. **URL**: Enter the website URL you want to record
2. **Duration**: Use the slider to set recording time (5-60 seconds)
3. **Circle Size**: Adjust the webcam overlay size (150-300px)
4. **Position**: Click one of the 4 position options for overlay placement

### Step 3: Start Recording
1. Click the "Start Recording" button
2. Monitor the progress in real-time
3. Wait for the recording and processing to complete

### Step 4: Preview and Download Your Video
1. Find your recording in the "Completed Recordings" section
2. Click the play button to preview the video in the browser
3. The video will automatically open for preview when recording completes
4. Click the download button to save the video to your computer

## UI Features

- **Dark Theme**: Professional dark gradient background
- **Glass-morphism Effects**: Modern translucent card designs
- **Smooth Animations**: Subtle transitions and hover effects
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live progress indicators and status messages

## API Endpoints

### `POST /api/upload`
Uploads a webcam video file
- Accepts: `multipart/form-data` with MP4 file
- Returns: `{ success: true, filename: string }`

### `POST /api/record`
Starts a recording session
- Body: `{ url, duration, webcamFile, circleSize, positionX, positionY }`
- Returns: `{ success: true, filename: string }`

### `GET /api/recordings`
Lists all completed recordings
- Returns: Array of recording objects with metadata

### `GET /recordings/:filename`
Downloads a specific recording file

## File Structure

```
├── index.html          # Main HTML file with Tailwind CSS
├── app.js             # React application component
├── server.js          # Express server with API endpoints
├── uploads/           # Uploaded webcam videos (git-ignored)
└── recordings/        # Completed recordings (git-ignored)
```

## Configuration

The application uses these environment variables (optional):
- `PORT`: Server port (default: 3000)
- `RECORDING_DURATION`: Default recording duration in ms
- `BROWSERLESS_TOKEN`: Your Browserless.io token (from .env)

## Troubleshooting

### "Server not starting"
- Check if port 3000 is already in use
- Ensure all dependencies are installed: `npm install`

### "Upload failed"
- Verify the file is MP4 format
- Check file size is under 100MB
- Ensure `uploads/` directory has write permissions

### "Recording failed"
- Verify `.env` file contains valid `BROWSERLESS_TOKEN`
- Check console logs for specific error messages
- Ensure sufficient disk space for recordings

## Development

To modify the UI:
1. Edit `app.js` for React components
2. Tailwind classes can be added directly in JSX
3. Server logic is in `server.js`

The application uses:
- React 18 for UI components
- Tailwind CSS for styling
- Express.js for the backend
- Multer for file uploads