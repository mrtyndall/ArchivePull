document.addEventListener('DOMContentLoaded', () => {
  // Set logo path
  const logoImg = document.querySelector('.app-logo');
  if (logoImg) {
    logoImg.src = './assets/logo.png';
    
    // Add error handling
    logoImg.onerror = () => {
      console.error('Failed to load logo');
    };
    
    logoImg.onload = () => {
      console.log('Logo loaded successfully');
    };
  }
  
  // Elements
  const urlInput = document.getElementById('url');
  const destinationInput = document.getElementById('destination');
  const browseBtn = document.getElementById('browse-btn');
  const codecSelect = document.getElementById('codec');
  const containerRadios = document.getElementsByName('container');
  const bitrate1080 = document.getElementById('bitrate-1080');
  const bitrate1440 = document.getElementById('bitrate-1440');
  const bitrate2160 = document.getElementById('bitrate-2160');
  const includeTranscriptCheckbox = document.getElementById('include-transcript');
  const metadataCheckboxes = document.getElementsByName('metadata');
  const downloadBtn = document.getElementById('download-btn');
  const statusMessage = document.getElementById('status-message');
  const progressBar = document.getElementById('progress');
  const progressText = document.getElementById('progress-text');
  const logOutput = document.getElementById('log-output');
  const videoPreview = document.getElementById('video-preview');
  const thumbnail = document.getElementById('thumbnail');
  const videoTitle = document.getElementById('video-title');
  const videoChannel = document.getElementById('video-channel');
  const videoDuration = document.getElementById('video-duration');
  
  // Add these variables at the top of your DOMContentLoaded event handler
  let totalFrames = 0;
  let isTranscoding = false;
  let downloadComplete = false;
  
  // Add this at the beginning of your DOMContentLoaded event handler
  window.onerror = function(message, source, lineno, colno, error) {
    console.log('JavaScript error:', message);
    console.log('Source:', source);
    console.log('Line:', lineno);
    console.log('Column:', colno);
    console.log('Error object:', error);
    return false;
  };
  
  // Browse button click handler
  browseBtn.addEventListener('click', async () => {
    const folder = await window.api.selectFolder();
    if (folder) {
      destinationInput.value = folder;
    }
  });
  
  // Download button click handler
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    const destination = destinationInput.value.trim();
    
    // Validate inputs
    if (!url) {
      alert('Please enter a YouTube URL.');
      return;
    }
    
    if (!destination) {
      alert('Please select a destination folder.');
      return;
    }
    
    // Get selected container format
    let container = '.mov';
    for (const radio of containerRadios) {
      if (radio.checked) {
        container = radio.value;
        break;
      }
    }
    
    // Get selected metadata options
    const metadata = {};
    for (const checkbox of metadataCheckboxes) {
      metadata[checkbox.value] = checkbox.checked;
    }
    
    // Get all bitrate settings
    const userBitrates = {
      '8k-standard': document.getElementById('bitrate-8k-standard').value,
      '8k-high': document.getElementById('bitrate-8k-high').value,
      '4k-standard': document.getElementById('bitrate-4k-standard').value,
      '4k-high': document.getElementById('bitrate-4k-high').value,
      '1440p-standard': document.getElementById('bitrate-1440p-standard').value,
      '1440p-high': document.getElementById('bitrate-1440p-high').value,
      '1080p-standard': document.getElementById('bitrate-1080p-standard').value,
      '1080p-high': document.getElementById('bitrate-1080p-high').value,
    };
    
    // Define HDR bitrates (higher values)
    const hdrBitrates = {
      '8k-standard': 200,
      '8k-high': 300,
      '4k-standard': 120,
      '4k-high': 170,
      '1440p-standard': 70,
      '1440p-high': 100,
      '1080p-standard': 40,
      '1080p-high': 60,
    };
    
    // Use HDR bitrates if video is HDR, but only if they're higher than user selection
    const finalBitrates = { ...userBitrates };
    if (window.videoIsHDR) {
      Object.keys(userBitrates).forEach(key => {
        // Use the higher of user-selected bitrate or HDR bitrate
        finalBitrates[key] = Math.max(parseInt(userBitrates[key]), hdrBitrates[key]);
      });
    }
    
    // Add HDR flag to final bitrates
    finalBitrates.isHDR = window.videoIsHDR || false;
    
    // Disable download button
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Downloading...';
    
    // Update status
    statusMessage.textContent = 'Download started. Please wait...';
    statusMessage.className = 'info';
    
    // Reset progress
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    
    // Reset progress tracking variables
    totalFrames = 0;
    isTranscoding = false;
    downloadComplete = false;
    progressBar.classList.remove('indeterminate');
    
    // Clear log
    logOutput.textContent = '# YT-DLP Web App + Transcode Pipeline\n';
    logOutput.textContent += `# Current time: ${new Date().toLocaleString()}\n`;
    logOutput.textContent += '# System ready\n\n';
    
    try {
      // Start download
      const options = {
        url,
        destination,
        codec: codecSelect.value,
        container,
        bitrates: finalBitrates,
        includeTranscript: includeTranscriptCheckbox.checked,
        metadata
      };
      
      // Log settings
      logOutput.textContent += 'Running with settings:\n';
      logOutput.textContent += `- Codec: ${options.codec}\n`;
      logOutput.textContent += `- Container: ${options.container}\n`;
      logOutput.textContent += `- HDR Content: ${options.bitrates.isHDR ? 'Yes (Auto-detected)' : 'No'}\n`;
      
      const selectedMetadata = Object.entries(options.metadata)
        .filter(([_, value]) => value)
        .map(([key, _]) => key);
      
      logOutput.textContent += `- Metadata: ${selectedMetadata.join(', ')}\n\n`;
      
      const result = await window.api.startDownload(options);
      
      if (result.success) {
        statusMessage.textContent = '✅ ' + result.message;
        statusMessage.className = 'success';
        triggerConfetti();
      } else {
        statusMessage.textContent = '❌ ' + result.message;
        statusMessage.className = 'error';
      }
    } catch (error) {
      statusMessage.textContent = '❌ Error: ' + error.message;
      statusMessage.className = 'error';
    } finally {
      // Re-enable download button
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Download & Transcode';
    }
  });
  
  // Register progress update handler
  window.api.onProgressUpdate((value) => {
    progressBar.style.width = `${value}%`;
    progressText.textContent = `${Math.round(value)}%`;
  });
  
  // Update the FFmpeg progress parsing function
  const parseFFmpegProgress = (line) => {
    // Look for frame= XXX fps= XXX q= XXX size= XXX time=XX:XX:XX.XX bitrate= XXXXX speed= XXX
    const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);
      const seconds = parseFloat(timeMatch[3]);
      const currentSeconds = hours * 3600 + minutes * 60 + seconds;
      
      // Calculate percentage based on video duration
      const totalDuration = window.currentVideoDuration || 0;
      if (totalDuration > 0) {
        const percent = Math.min(Math.round((currentSeconds / totalDuration) * 100), 100);
        return percent;
      }
    }
    return null;
  };

  // Update the log handler to only show download speed
  window.api.onLogUpdate((line) => {
    // Add the line to the log
    logOutput.textContent += line + '\n';
    logOutput.scrollTop = logOutput.scrollHeight;

    // Handle download progress with speed only
    const downloadMatch = line.match(/\[download\]\s+(\d+\.\d+)%\s+of\s+~?\s*[\d.]+\w+\s+at\s+([\d.]+(?:\w+\/s|B\/s))/);
    if (downloadMatch && !isTranscoding) {
      const percent = parseFloat(downloadMatch[1]);
      const speed = downloadMatch[2];
      
      progressBar.style.width = `${percent}%`;
      progressText.textContent = `Download: ${Math.round(percent)}%`;
      statusMessage.textContent = `Downloading video... ${speed}`;
    }

    // Handle download completion
    if (line.includes('Destination:') && line.includes('.mkv')) {
      downloadComplete = true;
      progressBar.style.width = '100%';
      progressText.textContent = 'Download: 100%';
      statusMessage.textContent = 'Download complete. Preparing for transcoding...';
    }

    // Reset progress when transcoding starts
    if (line.includes('Processing file:')) {
      progressBar.style.width = '0%';
      progressText.textContent = '0%';
      statusMessage.textContent = 'Starting transcoding...';
      isTranscoding = true;
    }

    // Update progress during transcoding
    if (isTranscoding && line.includes('time=')) {
      const percent = parseFFmpegProgress(line);
      if (percent !== null) {
        progressBar.style.width = `${percent}%`;
        progressText.textContent = `Transcoding: ${percent}%`;
        statusMessage.textContent = `Transcoding: ${percent}%`;
      }
    }

    // Handle completion
    if (line.includes('Transcoding completed successfully')) {
      progressBar.style.width = '100%';
      progressText.textContent = '100%';
      statusMessage.textContent = 'Transcoding completed!';
      isTranscoding = false;
      triggerConfetti();
    }

    // Handle errors
    if (line.includes('Error') || line.includes('error') || line.includes('failed')) {
      statusMessage.textContent = 'Error: ' + line.trim();
      statusMessage.className = 'error';
      progressBar.classList.remove('indeterminate');
      progressBar.classList.remove('transcoding');
    }
  });

  // Update the URL input handler to handle both preview and duration
  urlInput.addEventListener('input', debounce(async () => {
    const url = urlInput.value.trim();
    if (isValidYouTubeUrl(url)) {
      try {
        // Show loading state
        videoPreview.classList.remove('hidden');
        videoTitle.textContent = 'Loading...';
        videoChannel.textContent = '';
        videoDuration.textContent = '';
        thumbnail.style.display = 'none';

        // Fetch video info
        const info = await window.api.getVideoInfo(url);
        if (info) {
          // Store duration for progress calculation
          window.currentVideoDuration = info.duration;

          // Update preview
          thumbnail.src = info.thumbnail;
          thumbnail.style.display = '';
          videoTitle.textContent = info.title;
          videoChannel.textContent = info.channel;
          videoDuration.textContent = `Duration: ${formatDuration(info.duration)}`;
          
          // Store HDR status
          window.videoIsHDR = info.isHDR;
          
          // Show HDR indicator if detected
          if (info.isHDR) {
            const hdrIndicator = document.createElement('p');
            hdrIndicator.textContent = 'HDR Content Detected';
            hdrIndicator.style.color = 'var(--warning)';
            hdrIndicator.style.fontWeight = 'bold';
            
            if (videoChannel.nextElementSibling) {
              videoChannel.parentNode.insertBefore(hdrIndicator, videoChannel.nextElementSibling.nextElementSibling);
            } else {
              videoChannel.parentNode.appendChild(hdrIndicator);
            }
          }
        } else {
          videoPreview.classList.add('hidden');
        }
      } catch (error) {
        console.error('Error getting video info:', error);
        videoPreview.classList.add('hidden');
      }
    } else {
      videoPreview.classList.add('hidden');
    }
  }, 500));

  // Add handlers for showing codec descriptions
  codecSelect.addEventListener('change', () => {
    updateCodecDescription(codecSelect.value);
  });
  
  // Initialize descriptions
  initializeDescriptions();
  
  // Add this to your DOMContentLoaded event handler
  const containerDescriptions = {
    '.mov': '<strong>.mov:</strong> Apple\'s container format, preferred for ProRes and professional workflows. Better compatibility with editing software.',
    '.mp4': '<strong>.mp4:</strong> More widely compatible container, better for sharing and web playback. Recommended for H.264/H.265 codecs.'
  };

  // Function to update container description
  function updateContainerDescription(container) {
    console.log('Updating container description for:', container);
    const descriptionText = containerDescriptions[container] || '';
    document.getElementById('container-description-text').innerHTML = descriptionText;
  }

  // Add event listeners to container radio buttons
  document.getElementById('container-mov').addEventListener('change', function() {
    if (this.checked) {
      updateContainerDescription('.mov');
    }
  });

  document.getElementById('container-mp4').addEventListener('change', function() {
    if (this.checked) {
      updateContainerDescription('.mp4');
    }
  });

  // Initialize with the default selection
  const initialContainer = document.querySelector('input[name="container"]:checked').value;
  updateContainerDescription(initialContainer);

  // Add this to your DOMContentLoaded event handler
  // Handle all help toggle buttons
  console.log('Help toggle buttons:');
  document.querySelectorAll('.help-toggle').forEach(button => {
    const id = button.id;
    let targetId;
    
    // Map toggle button IDs to their corresponding description elements
    if (id === 'toggle-bitrate-help') {
      targetId = 'bitrate-description';
    } else if (id === 'toggle-hdr-help') {
      targetId = 'hdr-description';
    } else if (id === 'toggle-container-help') {
      targetId = 'container-help-description';
    }
    
    if (targetId) {
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        button.addEventListener('click', () => {
          console.log(`Toggling ${targetId}`);
          targetElement.classList.toggle('hidden');
        });
      }
    }
  });

  // Make sure the correct codec description is shown initially
  setTimeout(() => {
    updateCodecDescription(codecSelect.value);
  }, 100);

  // Initialize container description based on initial selection
  if (document.querySelector('input[name="container"][value=".mov"]').checked) {
    document.getElementById('desc-mov').style.display = 'block';
    document.getElementById('desc-mp4').style.display = 'none';
  } else if (document.querySelector('input[name="container"][value=".mp4"]').checked) {
    document.getElementById('desc-mov').style.display = 'none';
    document.getElementById('desc-mp4').style.display = 'block';
  }

  // Debug function to manually toggle container descriptions
  window.toggleContainerDesc = function(container) {
    console.log('Manual toggle for:', container);
    if (container === '.mov') {
      document.getElementById('desc-mov').style.display = 'block';
      document.getElementById('desc-mp4').style.display = 'none';
    } else if (container === '.mp4') {
      document.getElementById('desc-mov').style.display = 'none';
      document.getElementById('desc-mp4').style.display = 'block';
    }
  };

  // Add this to your DOMContentLoaded event handler
  const toggleContainerHelp = document.getElementById('toggle-container-help');
  const containerHelpDescription = document.getElementById('container-help-description');

  toggleContainerHelp.addEventListener('click', () => {
    containerHelpDescription.classList.toggle('hidden');
  });

  // Add this at the global scope
  window.toggleHelp = function(targetId) {
    const element = document.getElementById(targetId);
    if (element) {
      element.classList.toggle('hidden');
      console.log(`Toggled ${targetId}`);
    } else {
      console.log(`Element with ID ${targetId} not found`);
    }
  };

  // This will handle ALL help-toggle buttons
  document.body.addEventListener('click', function(e) {
    if (e.target.classList.contains('help-toggle')) {
      let targetId = null;
      if (e.target.id === 'toggle-container-help') targetId = 'container-help-description';
      if (e.target.id === 'toggle-bitrate-help') targetId = 'bitrate-description';
      if (e.target.id === 'toggle-hdr-help') targetId = 'hdr-description';
      if (targetId) {
        const desc = document.getElementById(targetId);
        if (desc) desc.classList.toggle('hidden');
      }
    }
  });

  // Minimal collapsible section implementation
  document.querySelectorAll('.collapsible-header').forEach(header => {
    header.addEventListener('click', function() {
      const section = this.parentElement;
      section.classList.toggle('collapsed');
      console.log('Section toggled:', section.id);
    });
  });

  // Initialize sections based on saved state or default to collapsed
  function initializeCollapsibleSections() {
    document.querySelectorAll('.collapsible-section').forEach(section => {
      const sectionId = section.getAttribute('id');
      if (sectionId) {
        // Check localStorage first
        const savedState = localStorage.getItem(sectionId + '-collapsed');
        
        if (savedState === null) {
          // No saved state, use the default (collapsed)
          section.classList.add('collapsed');
        } else {
          // Use saved state
          if (savedState === 'true') {
            section.classList.add('collapsed');
          } else {
            section.classList.remove('collapsed');
          }
        }
      }
    });
  }

  // Call this function at the end of your DOMContentLoaded event handler
  initializeCollapsibleSections();

  // Add this function to show the initial codec description
  function showInitialCodecDescription() {
    // Get the initially selected codec
    const codecSelect = document.getElementById('codec');
    const selectedCodec = codecSelect.options[codecSelect.selectedIndex].value;
    
    console.log('Showing initial description for codec:', selectedCodec);
    
    // Hide all codec descriptions first
    document.querySelectorAll('.codec-description').forEach(desc => {
      desc.classList.add('hidden');
    });
    
    // Format the codec value to match the description ID format
    const formattedCodec = selectedCodec.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '');
    const descriptionId = `desc-${formattedCodec}`;
    
    console.log('Looking for description element with ID:', descriptionId);
    
    // Show the description for the selected codec
    const descElement = document.getElementById(descriptionId);
    if (descElement) {
      descElement.classList.remove('hidden');
      console.log('Description element found and displayed');
    } else {
      console.log('Description element not found');
    }
  }

  // Show the initial codec description
  showInitialCodecDescription();

  // Show the H.264 (GPU) description immediately on page load
  // This is a direct approach to ensure it's visible
  setTimeout(() => {
    console.log('Directly showing H.264 (GPU) description');
    
    // Hide all descriptions first
    document.querySelectorAll('.codec-description').forEach(desc => {
      desc.classList.add('hidden');
    });
    
    // Show the H.264 (GPU) description
    const h264GpuDesc = document.getElementById('desc-h-264-gpu');
    if (h264GpuDesc) {
      h264GpuDesc.classList.remove('hidden');
      console.log('H.264 (GPU) description shown successfully');
    } else {
      console.error('Could not find H.264 (GPU) description element');
      
      // Log all available description elements for debugging
      console.log('Available description elements:');
      document.querySelectorAll('.description-box').forEach(desc => {
        console.log(`- ${desc.id}`);
      });
    }
  }, 100); // Small delay to ensure DOM is fully processed

  // Store video duration when video info is loaded
  const updateVideoInfo = async (url) => {
    try {
      const info = await window.api.getVideoInfo(url);
      if (info) {
        window.currentVideoDuration = info.duration; // Store duration for progress calculation
        // ... rest of your video info update code ...
      }
    } catch (error) {
      console.error('Error getting video info:', error);
    }
  };
});

// Helper function to validate YouTube URL
function isValidYouTubeUrl(url) {
  const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;
  return pattern.test(url);
}

// Helper function to format duration in seconds to MM:SS
function formatDuration(seconds) {
  if (!seconds) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Debounce function to prevent too many API calls
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

// Function to update codec description
function updateCodecDescription(codec) {
  console.log('Updating codec description for:', codec);
  
  // Hide all codec descriptions
  document.querySelectorAll('.codec-description').forEach(desc => {
    desc.classList.add('hidden');
  });
  
  // Direct mapping for known codecs
  const codecMap = {
    'H.264 (GPU)': 'desc-h-264-gpu',
    'H.264 (CPU)': 'desc-h-264-cpu',
    'H.265 (GPU)': 'desc-h-265-gpu',
    'H.265 (CPU)': 'desc-h-265-cpu',
    'ProRes 422': 'desc-prores-422',
    'ProRes 422 HQ': 'desc-prores-422-hq',
    'ProRes 422 LT': 'desc-prores-422-lt',
    'ProRes 4444': 'desc-prores-4444',
    'DNxHD': 'desc-dnxhd',
    'AV1': 'desc-av1'
  };
  
  // Try direct mapping first
  let descId = codecMap[codec];
  
  // If no direct mapping, try the formatted approach
  if (!descId) {
    let formattedId = codec.toLowerCase()
      .replace(/[\s()\.]/g, '-')
      .replace(/\//g, '-');
    descId = `desc-${formattedId}`;
  }
  
  console.log('Looking for element with ID:', descId);
  
  // Show the selected codec description
  const selectedDesc = document.getElementById(descId);
  if (selectedDesc) {
    console.log('Found description element:', selectedDesc.id);
    selectedDesc.classList.remove('hidden');
  } else {
    console.log('No matching description element found');
    console.log('Available description elements:');
    document.querySelectorAll('.codec-description').forEach(desc => {
      console.log(`- ${desc.id}`);
    });
  }
}

// Function to update container description
function updateContainerDescription(container) {
  console.log('Updating container description for:', container);
  
  // Hide all container descriptions
  document.querySelectorAll('.container-description').forEach(desc => {
    desc.classList.add('hidden');
  });
  
  // Direct mapping for container formats
  const containerMap = {
    '.mov': 'desc-mov',
    '.mp4': 'desc-mp4'
  };
  
  // Try direct mapping first
  let descId = containerMap[container];
  
  // If no direct mapping, try the formatted approach
  if (!descId) {
    descId = `desc-${container.replace('.', '')}`;
  }
  
  console.log('Looking for container description with ID:', descId);
  
  // Show the selected container description
  const selectedDesc = document.getElementById(descId);
  if (selectedDesc) {
    console.log('Found container description element:', selectedDesc.id);
    selectedDesc.classList.remove('hidden');
  } else {
    console.log('No matching container description found');
    console.log('Available container descriptions:');
    document.querySelectorAll('.container-description').forEach(desc => {
      console.log(`- ${desc.id}`);
    });
  }
}

function initializeDescriptions() {
  // Get the currently selected codec
  const initialCodec = codecSelect.options[codecSelect.selectedIndex].value;
  console.log('Initial codec selection:', initialCodec);
  updateCodecDescription(initialCodec);
  
  // Get the currently selected container
  const defaultContainer = document.querySelector('input[name="container"]:checked').value;
  console.log('Initial container selection:', defaultContainer);
  updateContainerDescription(defaultContainer);
  
  // Log all available container descriptions
  console.log('Available container descriptions:');
  document.querySelectorAll('.container-description').forEach(desc => {
    console.log(`- ${desc.id}`);
  });
}

// Add these functions at the global scope
function showMovDescription() {
  document.getElementById('desc-mov').classList.remove('hidden');
  document.getElementById('desc-mp4').classList.add('hidden');
  console.log('MOV description shown');
}

function showMp4Description() {
  document.getElementById('desc-mov').classList.add('hidden');
  document.getElementById('desc-mp4').classList.remove('hidden');
  console.log('MP4 description shown');
}

// Add this at the very end of your file, outside any existing event handlers
// This ensures it runs independently of other code

// Standalone collapsible section handler
(function() {
  console.log('Setting up standalone collapsible sections');
  
  // Direct DOM manipulation approach
  const headers = document.querySelectorAll('.collapsible-header');
  console.log('Found', headers.length, 'collapsible headers');
  
  headers.forEach(header => {
    header.onclick = function(event) {
      // Prevent event from bubbling up
      event.stopPropagation();
      
      // Get the parent section
      const section = this.parentElement;
      console.log('Clicked on section:', section.id);
      
      // Toggle the collapsed class
      if (section.classList.contains('collapsed')) {
        section.classList.remove('collapsed');
        console.log('Expanding section');
        
        // Directly manipulate the content element
        const content = section.querySelector('.collapsible-content');
        if (content) {
          content.style.display = 'block';
        }
      } else {
        section.classList.add('collapsed');
        console.log('Collapsing section');
        
        // Directly manipulate the content element
        const content = section.querySelector('.collapsible-content');
        if (content) {
          content.style.display = 'none';
        }
      }
    };
  });
  
  console.log('Collapsible sections setup complete');
})();

// Global toggle function
function toggleSection(id) {
  const section = document.getElementById(id);
  if (!section) return;
  
  console.log('Toggling section:', id);
  
  const content = section.querySelector('.collapsible-content');
  if (!content) return;
  
  if (section.classList.contains('collapsed')) {
    section.classList.remove('collapsed');
    content.style.display = 'block';
    console.log('Section expanded');
  } else {
    section.classList.add('collapsed');
    content.style.display = 'none';
    console.log('Section collapsed');
  }
}

// Add this function near the top of your file
function triggerConfetti() {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#00ffff', '#ff00ff']
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });

  fire(0.2, {
    spread: 60,
  });

  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2
  });

  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
} 