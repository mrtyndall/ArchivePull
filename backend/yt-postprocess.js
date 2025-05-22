const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get the path to the bundled binaries
const getBinaryPath = (binaryName) => {
  // Try multiple possible locations
  const possiblePaths = [
    // Development path
    path.join(__dirname, '..', 'resources', process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux', 
              process.platform === 'win32' ? `${binaryName}.exe` : binaryName),
    
    // Production path
    path.join(process.resourcesPath || '', 'bin', 
              process.platform === 'win32' ? `${binaryName}.exe` : binaryName),
              
    // Fallback path
    path.join(__dirname, '..', 'bin', 
              process.platform === 'win32' ? `${binaryName}.exe` : binaryName)
  ];
  
  // Find the first path that exists
  for (const binPath of possiblePaths) {
    console.log(`Checking for binary at: ${binPath}`);
    if (fs.existsSync(binPath)) {
      console.log(`Found binary at: ${binPath}`);
      return binPath;
    }
  }
  
  // Default to the development path even if it doesn't exist
  const defaultPath = possiblePaths[0];
  console.log(`No binary found, defaulting to: ${defaultPath}`);
  return defaultPath;
};

// Add platform encoder detection function
const getPlatformEncoder = () => {
  if (process.platform === 'darwin') {
    // For macOS, use VideoToolbox hardware encoding
    return 'h264_videotoolbox';
  } else if (process.platform === 'win32') {
    // For Windows, try NVIDIA first, fall back to CPU
    try {
      const result = spawn(FFMPEG_PATH, ['-encoders']).toString();
      return result.includes('h264_nvenc') ? 'h264_nvenc' : 'libx264';
    } catch {
      return 'libx264';
    }
  } else {
    // For Linux or other platforms, use CPU encoding
    return 'libx264';
  }
};

const FFMPEG_PATH = getBinaryPath('ffmpeg');

// Get the input file path from command line arguments
const inputFile = process.argv[2];
if (!inputFile) {
  console.error('No input file specified');
  process.exit(1);
}

console.log(`Processing file: ${inputFile}`);

// Parse environment variables
const codec = process.env.YT_CODEC || 'H.264 (GPU)';
const container = process.env.YT_CONTAINER || '.mp4';
const isHDR = process.env.YT_IS_HDR === 'true';

// Get bitrate settings from environment variables
const bitrates = {
  '8k-standard': process.env.YT_BITRATE_8K_STANDARD || '120',
  '8k-high': process.env.YT_BITRATE_8K_HIGH || '180',
  '4k-standard': process.env.YT_BITRATE_4K_STANDARD || '40',
  '4k-high': process.env.YT_BITRATE_4K_HIGH || '60',
  '1440p-standard': process.env.YT_BITRATE_1440P_STANDARD || '16',
  '1440p-high': process.env.YT_BITRATE_1440P_HIGH || '24',
  '1080p-standard': process.env.YT_BITRATE_1080P_STANDARD || '8',
  '1080p-high': process.env.YT_BITRATE_1080P_HIGH || '12'
};

// Get metadata options
const metadataOptions = (process.env.YT_METADATA || '').split(',');

// Determine output file path
const outputFile = inputFile.replace(/\.mkv$/, container);  // Just change the extension
console.log(`Output file: ${outputFile}`);

// Build FFmpeg command based on codec
let ffmpegArgs = [];

// Input file
ffmpegArgs.push('-i', inputFile);

// Add codec-specific options
if (codec.includes('H.264')) {
  if (codec.includes('GPU')) {
    const platformEncoder = getPlatformEncoder();
    if (platformEncoder === 'h264_videotoolbox') {
      ffmpegArgs.push('-c:v', 'h264_videotoolbox', '-b:v', bitrates['1080p-standard'] + 'M');
    } else if (platformEncoder === 'h264_nvenc') {
      ffmpegArgs.push('-c:v', 'h264_nvenc', '-preset', 'p7', '-tune', 'hq');
      ffmpegArgs.push('-b:v', bitrates['1080p-standard'] + 'M');
    } else {
      ffmpegArgs.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
    }
  } else {
    ffmpegArgs.push('-c:v', 'libx264', '-preset', 'slow', '-tune', 'film');
    ffmpegArgs.push('-b:v', bitrates['1080p-standard'] + 'M');
  }
} else if (codec.includes('H.265')) {
  if (codec.includes('GPU')) {
    ffmpegArgs.push('-c:v', 'hevc_nvenc', '-preset', 'p7', '-tune', 'hq');
  } else {
    ffmpegArgs.push('-c:v', 'libx265', '-preset', 'medium');
  }
  
  ffmpegArgs.push('-b:v', bitrates['1080p-standard'] + 'M');
} else if (codec.includes('ProRes')) {
  if (codec.includes('422 HQ')) {
    ffmpegArgs.push('-c:v', 'prores_ks', '-profile:v', '3');
  } else if (codec.includes('422 LT')) {
    ffmpegArgs.push('-c:v', 'prores_ks', '-profile:v', '1');
  } else if (codec.includes('4444')) {
    ffmpegArgs.push('-c:v', 'prores_ks', '-profile:v', '4');
  } else {
    ffmpegArgs.push('-c:v', 'prores_ks', '-profile:v', '2'); // Standard ProRes 422
  }
} else if (codec.includes('DNxHD')) {
  ffmpegArgs.push('-c:v', 'dnxhd', '-b:v', '120M');
} else if (codec.includes('AV1')) {
  ffmpegArgs.push('-c:v', 'libaom-av1', '-crf', '30', '-b:v', '0');
}

// Audio settings
ffmpegArgs.push('-c:a', 'aac', '-b:a', '320k');

// Simplify metadata handling
const getSimplifiedMetadata = (metadataFile) => {
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
    return {
      title: metadata.title || '',
      artist: metadata.uploader || '',
      date: metadata.upload_date || '',
      description: metadata.description || '',
      url: metadata.webpage_url || '',
      duration: metadata.duration || 0
    };
  } catch (error) {
    console.error('Error reading metadata:', error);
    return {};
  }
};

// Add metadata if available
const metadataFile = inputFile.replace(/\.[^/.]+$/, '') + '.info.json';
if (fs.existsSync(metadataFile)) {
  const metadata = getSimplifiedMetadata(metadataFile);
  
  // Add basic metadata
  if (metadata.title) ffmpegArgs.push('-metadata', `title=${metadata.title}`);
  if (metadata.artist) ffmpegArgs.push('-metadata', `artist=${metadata.artist}`);
  if (metadata.date) ffmpegArgs.push('-metadata', `date=${metadata.date}`);
  if (metadata.url) ffmpegArgs.push('-metadata', `comment=Source: ${metadata.url}`);
  
  // Create a metadata text file
  const metadataTextFile = path.join(path.dirname(inputFile), 'metadata.txt');
  const metadataText = `
Title: ${metadata.title}
Channel: ${metadata.artist}
Upload Date: ${metadata.date}
Duration: ${metadata.duration} seconds
URL: ${metadata.url}

Description:
${metadata.description}
`;
  
  fs.writeFileSync(metadataTextFile, metadataText);
}

// Output file
ffmpegArgs.push('-y', outputFile);

console.log('Running FFmpeg with args:', ffmpegArgs.join(' '));

// Run FFmpeg
const ffmpeg = spawn(FFMPEG_PATH, ffmpegArgs);

ffmpeg.stdout.on('data', (data) => {
  console.log(`FFmpeg stdout: ${data}`);
});

ffmpeg.stderr.on('data', (data) => {
  // FFmpeg outputs progress information to stderr
  console.log(`${data}`);
});

ffmpeg.on('close', (code) => {
  if (code === 0) {
    console.log('Transcoding completed successfully');
    
    // Clean up original files
    try {
      fs.unlinkSync(inputFile);  // Delete original .mkv
      fs.unlinkSync(inputFile.replace(/\.[^/.]+$/, '') + '.info.json');  // Delete original metadata
    } catch (error) {
      console.error('Error cleaning up:', error);
    }
  } else {
    console.error(`Transcoding failed with code ${code}`);
  }
});

ffmpeg.on('error', (err) => {
  console.error('Failed to start FFmpeg process:', err);
}); 