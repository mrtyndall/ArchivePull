const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

// Get the path to the bundled binaries
const getBinaryPath = (binaryName) => {
  // Try multiple possible locations
  const possiblePaths = [
    // Development path
    path.join(__dirname, 'resources', process.platform === 'win32' ? 'win' : process.platform === 'darwin' ? 'mac' : 'linux', 
              process.platform === 'win32' ? `${binaryName}.exe` : binaryName),
    
    // Production path
    path.join(process.resourcesPath, 'bin', 
              process.platform === 'win32' ? `${binaryName}.exe` : binaryName),
              
    // Fallback path
    path.join(__dirname, 'bin', 
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

// Get paths for FFmpeg and yt-dlp
const FFMPEG_PATH = getBinaryPath('ffmpeg');
const YTDLP_PATH = getBinaryPath('yt-dlp');

// Make binaries executable on Mac/Linux
if (process.platform !== 'win32') {
  try {
    fs.chmodSync(FFMPEG_PATH, '755');
    fs.chmodSync(YTDLP_PATH, '755');
    console.log('Made binaries executable');
  } catch (error) {
    console.error('Error making binaries executable:', error);
  }
}

// Log the binary paths
console.log('FFmpeg path:', FFMPEG_PATH);
console.log('yt-dlp path:', YTDLP_PATH);

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: "ArchivePull",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    backgroundColor: '#09090b'
  });

  mainWindow.loadFile('index.html');
  
  // Uncomment to open DevTools by default
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Handle folder selection
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

// Add this near the top of main.js
const createOutputFolder = (baseDir, videoTitle) => {
  // Create a safe folder name from video title
  const safeFolderName = videoTitle
    .replace(/[^a-z0-9]/gi, '_')  // Replace unsafe chars with underscore
    .replace(/_+/g, '_')          // Replace multiple underscores with single
    .toLowerCase();
  
  const outputFolder = path.join(baseDir, safeFolderName);
  
  // Create folder if it doesn't exist
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  
  return outputFolder;
};

// Handle download request
ipcMain.handle('start-download', async (event, options) => {
  const { url, destination, codec, container, bitrates, includeTranscript, metadata } = options;
  
  try {
    // Get video info first to create folder
    const { stdout } = await exec(`${YTDLP_PATH} -J ${url}`);
    const videoInfo = JSON.parse(stdout);
    const outputFolder = createOutputFolder(destination, videoInfo.title);
    
    // Create temp config file
    const tempConfigPath = path.join(app.getPath('temp'), 'yt-dlp-config.conf');
    let configContent = `
# Download best video+audio combo
-f bv*+ba/b

# Merge to .mkv before postprocessing
--merge-output-format mkv

# Output naming - keep the video ID in brackets
-o "${outputFolder}/%(title)s [%(id)s].%(ext)s"

# Save simplified metadata
--write-info-json
--no-write-playlist-metafiles
--no-write-comments
`;

    if (includeTranscript) {
      configContent += `
# Get captions
--write-auto-sub
--sub-lang en
--convert-subs srt
`;
    }

    configContent += `
# Trigger postprocessing script
--exec "node ./backend/yt-postprocess.js {}"
`;

    fs.writeFileSync(tempConfigPath, configContent);
    
    // Set up environment variables for the post-processing script
    const env = Object.assign({}, process.env);
    env.YT_CODEC = codec;
    env.YT_CONTAINER = container;
    env.YT_IS_HDR = bitrates.isHDR.toString();
    
    // Set all bitrate options
    env.YT_BITRATE_8K_STANDARD = bitrates['8k-standard'];
    env.YT_BITRATE_8K_HIGH = bitrates['8k-high'];
    env.YT_BITRATE_4K_STANDARD = bitrates['4k-standard'];
    env.YT_BITRATE_4K_HIGH = bitrates['4k-high'];
    env.YT_BITRATE_1440P_STANDARD = bitrates['1440p-standard'];
    env.YT_BITRATE_1440P_HIGH = bitrates['1440p-high'];
    env.YT_BITRATE_1080P_STANDARD = bitrates['1080p-standard'];
    env.YT_BITRATE_1080P_HIGH = bitrates['1080p-high'];
    
    // Create metadata flags
    const metadataFlags = [];
    for (const [key, value] of Object.entries(metadata)) {
      if (value) {
        metadataFlags.push(key.toLowerCase().replace(' ', '_'));
      }
    }
    env.YT_METADATA = metadataFlags.join(',');
    
    // Start the download process
    const ytDlp = spawn(YTDLP_PATH, [
      '--no-warnings',
      '-f', 'bv*+ba/b',
      '--merge-output-format', 'mkv',
      '--config-location', tempConfigPath,
      '-P', destination,
      '--progress',
      url
    ], { env });
    
    // Regular expression to extract download percentage
    const percentPattern = /\[download\]\s+(\d+\.\d+)%/;
    
    ytDlp.stdout.on('data', (data) => {
      const line = data.toString();
      mainWindow.webContents.send('log-update', line);
      
      // Try to extract percentage
      const match = percentPattern.exec(line);
      if (match) {
        const percent = parseFloat(match[1]);
        mainWindow.webContents.send('progress-update', percent);
      }
    });
    
    ytDlp.stderr.on('data', (data) => {
      mainWindow.webContents.send('log-update', data.toString());
    });
    
    return new Promise((resolve, reject) => {
      ytDlp.on('close', (code) => {
        // Clean up temp file
        fs.unlinkSync(tempConfigPath);
        
        if (code === 0) {
          resolve({ success: true, message: 'Download and processing complete!' });
        } else {
          resolve({ success: false, message: `Download failed with code: ${code}` });
        }
      });
      
      ytDlp.on('error', (err) => {
        reject({ success: false, message: err.message });
      });
    });
  } catch (error) {
    console.error('Error:', error);
    return { success: false, message: error.toString() };
  }
});

// Add this with your other IPC handlers
ipcMain.handle('get-video-info', async (event, url) => {
  try {
    const { stdout } = await exec(`${YTDLP_PATH} -J ${url}`);
    const videoInfo = JSON.parse(stdout);
    
    // Check if any formats are HDR
    const hasHDR = videoInfo.formats.some(format => {
      // Check if format description mentions HDR
      if (format.format_note && format.format_note.includes('HDR')) return true;
      
      // Check codec for HDR indicators
      if (format.vcodec && (
          format.vcodec.includes('vp9.2') || 
          (format.vcodec.includes('av01') && format.format_note && format.format_note.includes('HDR'))
        )) {
        return true;
      }
      
      return false;
    });
    
    return {
      title: videoInfo.title,
      channel: videoInfo.uploader,
      duration: videoInfo.duration,
      thumbnail: videoInfo.thumbnail,
      id: videoInfo.id,
      isHDR: hasHDR
    };
  } catch (error) {
    console.error('Error fetching video info:', error);
    return null;
  }
}); 