# Cloudflare Stream Integration

This application now automatically uploads recorded videos to Cloudflare Stream for reliable hosting and global delivery.

## Features

- **Automatic Upload**: Videos are automatically uploaded to Cloudflare Stream after recording
- **Upload Progress**: Real-time upload progress tracking
- **Stream Player**: Videos play using Cloudflare's optimized player
- **Share Links**: Get shareable links for your recordings
- **Status Tracking**: See upload and processing status for each video

## Setup

### 1. Cloudflare Account Setup

1. Sign up for [Cloudflare Stream](https://www.cloudflare.com/products/cloudflare-stream/)
2. Get your Account ID from the Cloudflare dashboard
3. Create an API token with Stream:Edit permissions

### 2. Environment Configuration

Add your Cloudflare credentials to the `.env` file:

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_AUTO_UPLOAD=true
```

### 3. Installation

```bash
npm install
```

## How It Works

1. **Recording**: When you finish recording, the video is saved locally
2. **Auto-Upload**: The server automatically uploads the video to Cloudflare Stream
3. **Processing**: Cloudflare processes the video for optimal streaming
4. **Ready**: Once processed, the video is available globally via Cloudflare's CDN

## User Interface

### Recording Status Badges

- 🟡 **Queued**: Waiting to start upload
- 🔵 **Uploading X%**: Currently uploading with progress
- 🟡 **Processing**: Cloudflare is processing the video
- 🟢 **Stream Ready**: Video is ready for sharing
- 🔴 **Upload Failed**: Something went wrong

### Actions

- **Play**: Watch the video using Cloudflare's player
- **Share**: Copy the shareable link to clipboard
- **Download**: Download the original video file

## API Endpoints

### Get Recording Status
```
GET /api/recordings/:id/status
```

Returns current upload status and Cloudflare URLs.

### Get Embed Code
```
GET /api/recordings/:id/embed
```

Returns HTML embed code for the video.

## Cloudflare URLs

Each uploaded video gets multiple URLs:

- **Playback URL**: `https://watch.cloudflarestream.com/{videoId}`
- **Embed URL**: `https://iframe.videodelivery.net/{videoId}`
- **Thumbnail**: `https://videodelivery.net/{videoId}/thumbnails/thumbnail.jpg`
- **HLS Stream**: `https://videodelivery.net/{videoId}/manifest/video.m3u8`
- **DASH Stream**: `https://videodelivery.net/{videoId}/manifest/video.mpd`

## Troubleshooting

### Upload Failed

1. Check your API credentials in `.env`
2. Verify your Cloudflare account has Stream enabled
3. Check server logs for specific error messages

### Video Not Playing

1. Wait for "Stream Ready" status
2. Check if the video is still processing
3. Try refreshing the page

### Slow Uploads

- Upload speed depends on your internet connection
- Large videos may take several minutes
- Progress is shown in real-time

## Storage Management

- Videos are stored both locally and on Cloudflare
- Local files can be deleted after successful upload
- Cloudflare Stream includes unlimited storage

## Security

- API tokens are never exposed to the frontend
- All uploads happen server-side
- Videos can be made private or public in Cloudflare dashboard

## Costs

Cloudflare Stream pricing:
- Storage: $5 per 1,000 minutes stored per month
- Streaming: $1 per 1,000 minutes delivered
- Check current pricing at cloudflare.com/products/cloudflare-stream/