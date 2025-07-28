import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';
import dotenv from 'dotenv';

dotenv.config();

class CloudflareStream extends EventEmitter {
    constructor() {
        super();
        this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
        this.apiToken = process.env.CLOUDFLARE_API_TOKEN;
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/stream`;
    }

    /**
     * Upload a video to Cloudflare Stream
     * @param {string} filePath - Path to the video file
     * @param {object} metadata - Optional metadata for the video
     * @returns {Promise<object>} - Upload result with video details
     */
    async uploadVideo(filePath, metadata = {}) {
        if (!fs.existsSync(filePath)) {
            throw new Error(`Video file not found: ${filePath}`);
        }

        const fileStats = fs.statSync(filePath);
        const fileSizeInMB = fileStats.size / (1024 * 1024);
        
        console.log(`📤 Uploading video to Cloudflare Stream (${fileSizeInMB.toFixed(2)} MB)...`);
        
        const form = new FormData();
        const fileStream = fs.createReadStream(filePath);
        
        // Track upload progress
        let uploadedBytes = 0;
        fileStream.on('data', (chunk) => {
            uploadedBytes += chunk.length;
            const progress = (uploadedBytes / fileStats.size) * 100;
            this.emit('progress', { 
                progress: Math.round(progress), 
                uploaded: uploadedBytes, 
                total: fileStats.size 
            });
        });

        form.append('file', fileStream);
        
        // Add metadata if provided
        if (metadata.name) {
            form.append('meta', JSON.stringify({ name: metadata.name }));
        }

        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    ...form.getHeaders()
                },
                body: form
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`Cloudflare API error: ${error.errors?.[0]?.message || response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`Upload failed: ${result.errors?.[0]?.message || 'Unknown error'}`);
            }

            console.log('✅ Video uploaded successfully to Cloudflare Stream');
            
            // Return video details
            return {
                success: true,
                videoId: result.result.uid,
                playbackUrl: `https://watch.cloudflarestream.com/${result.result.uid}`,
                embedUrl: `https://iframe.videodelivery.net/${result.result.uid}`,
                dashUrl: `https://videodelivery.net/${result.result.uid}/manifest/video.mpd`,
                hlsUrl: `https://videodelivery.net/${result.result.uid}/manifest/video.m3u8`,
                thumbnail: `https://videodelivery.net/${result.result.uid}/thumbnails/thumbnail.jpg`,
                status: result.result.status,
                duration: result.result.duration,
                created: result.result.created,
                modified: result.result.modified,
                size: result.result.size,
                preview: result.result.preview
            };
        } catch (error) {
            console.error('❌ Upload failed:', error.message);
            throw error;
        }
    }

    /**
     * Get video details from Cloudflare Stream
     * @param {string} videoId - The video ID
     * @returns {Promise<object>} - Video details
     */
    async getVideoDetails(videoId) {
        try {
            const response = await fetch(`${this.baseUrl}/${videoId}`, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to get video details: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(`Failed to get video details: ${result.errors?.[0]?.message || 'Unknown error'}`);
            }

            return {
                videoId: result.result.uid,
                playbackUrl: `https://watch.cloudflarestream.com/${result.result.uid}`,
                embedUrl: `https://iframe.videodelivery.net/${result.result.uid}`,
                thumbnail: `https://videodelivery.net/${result.result.uid}/thumbnails/thumbnail.jpg`,
                status: result.result.status,
                ready: result.result.readyToStream,
                duration: result.result.duration,
                created: result.result.created,
                size: result.result.size
            };
        } catch (error) {
            console.error('Error getting video details:', error.message);
            throw error;
        }
    }

    /**
     * Wait for video to be ready for streaming
     * @param {string} videoId - The video ID
     * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 5 minutes)
     * @returns {Promise<object>} - Video details when ready
     */
    async waitForVideoReady(videoId, maxWaitTime = 300000) {
        const startTime = Date.now();
        const checkInterval = 5000; // Check every 5 seconds

        console.log('⏳ Waiting for video to be ready for streaming...');

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const details = await this.getVideoDetails(videoId);
                
                if (details.ready) {
                    console.log('✅ Video is ready for streaming!');
                    return details;
                }
                
                if (details.status?.state === 'error') {
                    throw new Error('Video processing failed');
                }
                
                // Emit status update
                this.emit('status', {
                    state: details.status?.state || 'processing',
                    progress: details.status?.pctComplete || 0
                });
                
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            } catch (error) {
                console.error('Error checking video status:', error.message);
                await new Promise(resolve => setTimeout(resolve, checkInterval));
            }
        }

        throw new Error('Timeout waiting for video to be ready');
    }

    /**
     * Delete a video from Cloudflare Stream
     * @param {string} videoId - The video ID to delete
     * @returns {Promise<boolean>} - True if deleted successfully
     */
    async deleteVideo(videoId) {
        try {
            const response = await fetch(`${this.baseUrl}/${videoId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`
                }
            });

            if (!response.ok) {
                throw new Error(`Failed to delete video: ${response.statusText}`);
            }

            console.log('✅ Video deleted from Cloudflare Stream');
            return true;
        } catch (error) {
            console.error('Error deleting video:', error.message);
            throw error;
        }
    }

    /**
     * Generate embed code for a video
     * @param {string} videoId - The video ID
     * @param {object} options - Embed options
     * @returns {string} - HTML embed code
     */
    generateEmbedCode(videoId, options = {}) {
        const {
            width = '100%',
            height = '100%',
            autoplay = false,
            loop = false,
            muted = false,
            controls = true,
            preload = true
        } = options;

        const params = new URLSearchParams();
        if (autoplay) params.append('autoplay', 'true');
        if (loop) params.append('loop', 'true');
        if (muted) params.append('muted', 'true');
        if (!controls) params.append('controls', 'false');
        if (preload) params.append('preload', 'auto');

        const queryString = params.toString();
        const embedUrl = `https://iframe.videodelivery.net/${videoId}${queryString ? '?' + queryString : ''}`;

        return `<iframe 
    src="${embedUrl}"
    style="border: none; position: absolute; top: 0; left: 0; height: ${height}; width: ${width};"
    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
    allowfullscreen="true"
></iframe>`;
    }
}

// Export singleton instance
export default new CloudflareStream();