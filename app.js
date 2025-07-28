const { useState, useRef, useEffect } = React;

const App = () => {
    // State management
    const [webcamVideo, setWebcamVideo] = useState(null);
    const [websites, setWebsites] = useState([
        { id: Date.now(), url: 'https://webtrixdigital.com', duration: 30 }
    ]);
    const [circleSize, setCircleSize] = useState(200);
    const [overlayPosition, setOverlayPosition] = useState({ x: 'bottom', y: 'right' });
    const [isRecording, setIsRecording] = useState(false);
    const [recordingStatus, setRecordingStatus] = useState('');
    const [progress, setProgress] = useState(0);
    const [recordings, setRecordings] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [previewVideo, setPreviewVideo] = useState(null);
    const fileInputRef = useRef(null);

    // Load existing recordings on mount
    useEffect(() => {
        const loadRecordings = async () => {
            try {
                const response = await fetch('http://localhost:3000/api/recordings');
                if (response.ok) {
                    const data = await response.json();
                    setRecordings(data.map(rec => ({
                        id: rec.id,
                        url: 'Recording ' + rec.id,
                        duration: 30, // Default since we don't store this
                        timestamp: new Date(rec.created).toLocaleString(),
                        videoUrl: rec.videoUrl,
                        cloudflareStatus: rec.cloudflareStatus || 'none',
                        cloudflareUrls: rec.cloudflareUrls || null
                    })));
                    
                    // Monitor any recordings that are uploading
                    data.forEach(rec => {
                        if (rec.cloudflareStatus === 'pending' || rec.cloudflareStatus === 'uploading' || rec.cloudflareStatus === 'processing') {
                            monitorCloudflareUpload(rec.id);
                        }
                    });
                }
            } catch (error) {
                console.error('Failed to load recordings:', error);
            }
        };
        loadRecordings();
    }, []);
    
    // Monitor Cloudflare upload status
    const monitorCloudflareUpload = async (recordingId) => {
        const checkStatus = async () => {
            try {
                const response = await fetch(`http://localhost:3000/api/recordings/${recordingId}/status`);
                if (response.ok) {
                    const status = await response.json();
                    
                    // Update recording status in the list
                    setRecordings(prevRecordings => 
                        prevRecordings.map(rec => 
                            rec.id === recordingId 
                                ? { 
                                    ...rec, 
                                    cloudflareStatus: status.cloudflareStatus,
                                    cloudflareUrls: status.cloudflareUrls,
                                    uploadProgress: status.uploadProgress
                                  }
                                : rec
                        )
                    );
                    
                    // Continue monitoring if not yet ready
                    if (status.cloudflareStatus !== 'ready' && status.cloudflareStatus !== 'failed') {
                        setTimeout(() => checkStatus(), 2000);
                    }
                }
            } catch (error) {
                console.error('Error checking upload status:', error);
            }
        };
        
        checkStatus();
    };

    // Handle file upload
    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'video/mp4') {
            setUploadProgress(0);
            
            const formData = new FormData();
            formData.append('video', file);

            try {
                // Upload to server
                const xhr = new XMLHttpRequest();
                
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        setUploadProgress((e.loaded / e.total) * 100);
                    }
                });

                xhr.onload = () => {
                    if (xhr.status === 200) {
                        const response = JSON.parse(xhr.responseText);
                        setWebcamVideo({
                            name: file.name,
                            url: URL.createObjectURL(file),
                            size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
                            serverPath: response.path
                        });
                        setUploadProgress(0);
                    } else {
                        alert('Upload failed. Please try again.');
                        setUploadProgress(0);
                    }
                };

                xhr.onerror = () => {
                    alert('Upload failed. Please try again.');
                    setUploadProgress(0);
                };

                xhr.open('POST', 'http://localhost:3000/api/upload-webcam');
                xhr.send(formData);
            } catch (error) {
                console.error('Upload error:', error);
                alert('Upload failed. Please try again.');
                setUploadProgress(0);
            }
        }
    };

    // Start recording
    const startRecording = async () => {
        // Validate websites
        const validWebsites = websites.filter(w => w.url && w.url.startsWith('http'));
        if (validWebsites.length === 0) {
            alert('Please add at least one valid website URL');
            return;
        }

        setIsRecording(true);
        setProgress(0);
        setRecordingStatus('Initializing recording...');

        try {
            // Call the API to start recording
            const response = await fetch('http://localhost:3000/api/record', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    websites: validWebsites,
                    circleSize: circleSize,
                    position: overlayPosition
                })
            });

            if (!response.ok) {
                throw new Error('Recording failed');
            }

            // Calculate total duration
            const totalDuration = validWebsites.reduce((sum, w) => sum + w.duration, 0);
            
            // Simulate progress updates for each website
            let currentProgress = 0;
            for (let i = 0; i < validWebsites.length; i++) {
                const website = validWebsites[i];
                const websiteProgressStart = currentProgress;
                const websiteProgressEnd = ((i + 1) / validWebsites.length) * 80; // 80% for recording
                
                setRecordingStatus(`Recording website ${i + 1}/${validWebsites.length}: ${new URL(website.url).hostname}`);
                
                // Simulate progress for this website
                const steps = 5;
                for (let step = 0; step < steps; step++) {
                    const stepProgress = websiteProgressStart + ((websiteProgressEnd - websiteProgressStart) * (step / steps));
                    setProgress(Math.round(stepProgress));
                    await new Promise(resolve => setTimeout(resolve, (website.duration * 1000) / steps));
                }
                
                currentProgress = websiteProgressEnd;
            }
            
            // Processing phase
            setRecordingStatus('Processing and adding webcam overlay...');
            setProgress(85);
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            setRecordingStatus('Finalizing video...');
            setProgress(95);
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            setRecordingStatus('Complete!');
            setProgress(100);
            await new Promise(resolve => setTimeout(resolve, 500));

            const result = await response.json();
            
            // Add recording to list
            const newRecording = {
                id: result.recordingId,
                url: `${validWebsites.length} websites`,
                duration: totalDuration,
                timestamp: new Date().toLocaleString(),
                videoUrl: result.videoUrl,
                cloudflareStatus: 'pending',
                cloudflareUrls: null
            };
            setRecordings([newRecording, ...recordings]);
            
            // Start monitoring Cloudflare upload status
            if (result.cloudflareStatus === 'pending') {
                monitorCloudflareUpload(result.recordingId);
            }
            
            // Automatically show preview of the completed recording
            setPreviewVideo(`http://localhost:3000${result.videoUrl}`);
            
        } catch (error) {
            console.error('Recording error:', error);
            setRecordingStatus('Recording failed. Please try again.');
            await new Promise(resolve => setTimeout(resolve, 2000));
        } finally {
            setIsRecording(false);
            setRecordingStatus('');
            setProgress(0);
        }
    };

    // Position button component
    const PositionButton = ({ position, currentPosition, onClick }) => {
        const isActive = currentPosition.x === position.x && currentPosition.y === position.y;
        return (
            <button
                onClick={() => onClick(position)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                    isActive 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <rect x="4" y="4" width="16" height="16" rx="2" strokeWidth="2"/>
                    {position.x === 'top' && position.y === 'left' && <circle cx="8" cy="8" r="2" fill="currentColor"/>}
                    {position.x === 'top' && position.y === 'right' && <circle cx="16" cy="8" r="2" fill="currentColor"/>}
                    {position.x === 'bottom' && position.y === 'left' && <circle cx="8" cy="16" r="2" fill="currentColor"/>}
                    {position.x === 'bottom' && position.y === 'right' && <circle cx="16" cy="16" r="2" fill="currentColor"/>}
                </svg>
            </button>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6">
            {/* Background decorative elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10"></div>
            </div>

            <div className="relative z-10 max-w-6xl mx-auto">
                {/* Header */}
                <div className="text-center mb-10 fade-in">
                    <h1 className="text-5xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent mb-4">
                        Video Recording Studio
                    </h1>
                    <p className="text-gray-400 text-lg">Create professional video recordings with webcam overlay</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left Column - Upload and Settings */}
                    <div className="space-y-6">
                        {/* Upload Section */}
                        <div className="glass rounded-2xl p-6 fade-in">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                                Webcam Video
                            </h2>
                            
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/mp4"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                            
                            {!webcamVideo ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-8 border-2 border-dashed border-gray-700 rounded-xl hover:border-indigo-500 transition-all duration-300 group"
                                >
                                    <div className="text-center">
                                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-gray-400 mb-2">Click to upload webcam video</p>
                                        <p className="text-sm text-gray-600">MP4 format • Max 100MB</p>
                                    </div>
                                </button>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <div>
                                                <p className="font-medium">{webcamVideo.name}</p>
                                                <p className="text-sm text-gray-400">{webcamVideo.size}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setWebcamVideo(null);
                                                fileInputRef.current.value = '';
                                            }}
                                            className="text-gray-400 hover:text-red-400 transition-colors"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-full py-2 px-4 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors text-sm"
                                    >
                                        Replace video
                                    </button>
                                </div>
                            )}
                            
                            {uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="mt-4">
                                    <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                    <p className="text-sm text-gray-400 mt-2">Uploading... {Math.round(uploadProgress)}%</p>
                                </div>
                            )}
                        </div>

                        {/* Website List */}
                        <div className="glass rounded-2xl p-6 fade-in">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                                </svg>
                                Target Websites
                            </h2>
                            
                            <div className="space-y-3 mb-4">
                                {websites.map((website, index) => (
                                    <div key={website.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-1 space-y-3">
                                                <input
                                                    type="url"
                                                    value={website.url}
                                                    onChange={(e) => {
                                                        const updated = [...websites];
                                                        updated[index].url = e.target.value;
                                                        setWebsites(updated);
                                                    }}
                                                    placeholder="https://example.com"
                                                    className="w-full px-3 py-2 bg-gray-900/50 border border-gray-700 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all outline-none text-sm"
                                                />
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <label className="text-xs font-medium text-gray-400">Duration</label>
                                                        <span className="text-xs text-indigo-400 font-mono">{website.duration}s</span>
                                                    </div>
                                                    <input
                                                        type="range"
                                                        min="5"
                                                        max="60"
                                                        value={website.duration}
                                                        onChange={(e) => {
                                                            const updated = [...websites];
                                                            updated[index].duration = parseInt(e.target.value);
                                                            setWebsites(updated);
                                                        }}
                                                        className="w-full h-1"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (index > 0) {
                                                            const updated = [...websites];
                                                            [updated[index], updated[index - 1]] = [updated[index - 1], updated[index]];
                                                            setWebsites(updated);
                                                        }
                                                    }}
                                                    disabled={index === 0}
                                                    className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (index < websites.length - 1) {
                                                            const updated = [...websites];
                                                            [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
                                                            setWebsites(updated);
                                                        }
                                                    }}
                                                    disabled={index === websites.length - 1}
                                                    className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (websites.length > 1) {
                                                            setWebsites(websites.filter(w => w.id !== website.id));
                                                        }
                                                    }}
                                                    disabled={websites.length === 1}
                                                    className="p-1.5 text-gray-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors mt-1"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            <button
                                onClick={() => {
                                    setWebsites([...websites, { id: Date.now(), url: '', duration: 30 }]);
                                }}
                                className="w-full py-2 px-4 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg transition-colors text-sm font-medium text-indigo-300 flex items-center justify-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Add Website
                            </button>
                            
                            <div className="mt-4 pt-4 border-t border-gray-700/50">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-gray-400">Total Duration:</span>
                                    <span className="text-sm font-medium text-indigo-400">
                                        {websites.reduce((sum, w) => sum + w.duration, 0)}s
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Recording Settings */}
                        <div className="glass rounded-2xl p-6 fade-in">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                                </svg>
                                Recording Settings
                            </h2>

                            <div className="space-y-6">
                                {/* Circle Size */}
                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-sm font-medium text-gray-300">Webcam Size</label>
                                        <span className="text-sm text-indigo-400 font-mono">{circleSize}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="150"
                                        max="300"
                                        value={circleSize}
                                        onChange={(e) => setCircleSize(parseInt(e.target.value))}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-600 mt-1">
                                        <span>150px</span>
                                        <span>300px</span>
                                    </div>
                                </div>

                                {/* Position Controls */}
                                <div>
                                    <label className="text-sm font-medium text-gray-300 mb-3 block">Overlay Position</label>
                                    <div className="grid grid-cols-2 gap-2 max-w-[120px]">
                                        <PositionButton 
                                            position={{ x: 'top', y: 'left' }} 
                                            currentPosition={overlayPosition}
                                            onClick={setOverlayPosition}
                                        />
                                        <PositionButton 
                                            position={{ x: 'top', y: 'right' }} 
                                            currentPosition={overlayPosition}
                                            onClick={setOverlayPosition}
                                        />
                                        <PositionButton 
                                            position={{ x: 'bottom', y: 'left' }} 
                                            currentPosition={overlayPosition}
                                            onClick={setOverlayPosition}
                                        />
                                        <PositionButton 
                                            position={{ x: 'bottom', y: 'right' }} 
                                            currentPosition={overlayPosition}
                                            onClick={setOverlayPosition}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Recording Control and Output */}
                    <div className="space-y-6">
                        {/* Recording Control */}
                        <div className="glass rounded-2xl p-6 fade-in">
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Recording Control
                            </h2>

                            <button
                                onClick={startRecording}
                                disabled={isRecording || !webcamVideo}
                                className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 transform ${
                                    isRecording 
                                        ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                                        : webcamVideo
                                            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 hover:scale-[1.02] shadow-lg shadow-indigo-500/25'
                                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                {isRecording ? (
                                    <span className="flex items-center justify-center gap-3">
                                        <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Recording...
                                    </span>
                                ) : (
                                    'Start Recording'
                                )}
                            </button>

                            {!webcamVideo && (
                                <p className="text-sm text-gray-500 text-center mt-3">Upload a webcam video to start recording</p>
                            )}

                            {/* Status Display */}
                            {isRecording && (
                                <div className="mt-6 space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-400">{recordingStatus}</span>
                                        <span className="text-indigo-400 font-mono">{progress}%</span>
                                    </div>
                                    <div className="bg-gray-800 rounded-full h-2 overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-500"
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Preview */}
                        <div className="glass rounded-2xl p-6 fade-in">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                Preview
                            </h2>
                            <div className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video">
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-gray-600">Recording preview will appear here</p>
                                    </div>
                                </div>
                                {/* Webcam overlay preview */}
                                <div 
                                    className={`absolute ${overlayPosition.x}-4 ${overlayPosition.y}-4 bg-gray-800 rounded-full border-4 border-gray-700 shadow-2xl`}
                                    style={{ width: circleSize / 2 + 'px', height: circleSize / 2 + 'px' }}
                                >
                                    <div className="w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                                        <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Output Section */}
                        {recordings.length > 0 && (
                            <div className="glass rounded-2xl p-6 fade-in">
                                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                                    <svg className="w-6 h-6 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                    Recent Recordings
                                </h2>
                                <div className="space-y-3 max-h-64 overflow-y-auto">
                                    {recordings.map((recording) => (
                                        <div key={recording.id} className="bg-gray-800/50 rounded-lg p-4 hover:bg-gray-800/70 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-sm truncate max-w-[200px]">{recording.url}</p>
                                                        {/* Cloudflare Status Badge */}
                                                        {recording.cloudflareStatus && recording.cloudflareStatus !== 'none' && (
                                                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                                                recording.cloudflareStatus === 'ready' 
                                                                    ? 'bg-green-500/20 text-green-400'
                                                                    : recording.cloudflareStatus === 'failed'
                                                                    ? 'bg-red-500/20 text-red-400'
                                                                    : recording.cloudflareStatus === 'uploading'
                                                                    ? 'bg-blue-500/20 text-blue-400'
                                                                    : 'bg-yellow-500/20 text-yellow-400'
                                                            }`}>
                                                                {recording.cloudflareStatus === 'ready' && '✓ Stream Ready'}
                                                                {recording.cloudflareStatus === 'uploading' && `Uploading ${recording.uploadProgress || 0}%`}
                                                                {recording.cloudflareStatus === 'processing' && 'Processing...'}
                                                                {recording.cloudflareStatus === 'pending' && 'Queued'}
                                                                {recording.cloudflareStatus === 'failed' && 'Upload Failed'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs text-gray-500">{recording.duration}s • {recording.timestamp}</p>
                                                </div>
                                                <div className="flex gap-1">
                                                    {/* Play button - use Cloudflare if ready */}
                                                    <button 
                                                        onClick={() => {
                                                            if (recording.cloudflareStatus === 'ready' && recording.cloudflareUrls) {
                                                                setPreviewVideo(recording.cloudflareUrls.embed);
                                                            } else {
                                                                setPreviewVideo(`http://localhost:3000${recording.videoUrl}`);
                                                            }
                                                        }}
                                                        className="p-2 text-gray-400 hover:text-white transition-colors"
                                                        title="Play video"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                    </button>
                                                    
                                                    {/* Share button - only if Cloudflare ready */}
                                                    {recording.cloudflareStatus === 'ready' && recording.cloudflareUrls && (
                                                        <button
                                                            onClick={() => {
                                                                navigator.clipboard.writeText(recording.cloudflareUrls.playback);
                                                                alert('Share link copied to clipboard!');
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-indigo-400 transition-colors"
                                                            title="Copy share link"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.268C18.114 15.938 18 16.482 18 17c0 .482.114.938.316 1.342m0-2.684a3 3 0 110 2.684M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    
                                                    {/* Download button */}
                                                    <a 
                                                        href={`http://localhost:3000${recording.videoUrl}`}
                                                        download={`recording-${recording.id}.mp4`}
                                                        className="p-2 text-gray-400 hover:text-indigo-400 transition-colors block"
                                                        title="Download video"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                        </svg>
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Video Preview Modal */}
            {previewVideo && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={() => setPreviewVideo(null)}
                >
                    <div 
                        className="relative w-full max-w-4xl bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-gray-800">
                            <h3 className="text-lg font-semibold text-white">Video Preview</h3>
                            <button
                                onClick={() => setPreviewVideo(null)}
                                className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="relative bg-black">
                            {previewVideo.startsWith('http://localhost') ? (
                                <video
                                    src={previewVideo}
                                    controls
                                    autoPlay
                                    className="w-full h-auto max-h-[70vh]"
                                    onEnded={() => setPreviewVideo(null)}
                                >
                                    Your browser does not support the video tag.
                                </video>
                            ) : (
                                <div className="relative" style={{ paddingBottom: '56.25%' }}>
                                    <iframe
                                        src={previewVideo}
                                        className="absolute top-0 left-0 w-full h-full"
                                        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
                                        allowFullScreen={true}
                                        style={{ border: 'none' }}
                                    />
                                </div>
                            )}
                        </div>
                        <div className="p-4 bg-gray-900 border-t border-gray-800">
                            <div className="flex justify-between items-center">
                                <p className="text-sm text-gray-400">
                                    {previewVideo.startsWith('http://localhost') 
                                        ? 'Use spacebar to play/pause' 
                                        : 'Streaming from Cloudflare'}
                                </p>
                                {previewVideo.startsWith('http://localhost') && (
                                    <a
                                        href={previewVideo}
                                        download
                                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        Download
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));