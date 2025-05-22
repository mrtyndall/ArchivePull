# ArchivePull

A powerful YouTube downloader and transcoder application built with Electron. ArchivePull allows you to download videos from YouTube and transcode them to various professional formats with customizable settings.

## Features

- **High-Quality Downloads**: Download videos from YouTube at the highest available quality
- **Professional Transcoding**: Convert videos to various formats:
  - H.264/H.265 (with GPU acceleration support)
  - ProRes (422, 422 HQ, 422 LT, 4444)
  - DNxHD/DNxHR
  - AV1
- **Customizable Bitrates**: Fine-tune bitrate settings for different resolutions
- **Metadata Preservation**: Keep important video metadata
- **Subtitle Support**: Download and include subtitles/transcripts
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Prerequisites

- Node.js 14+
- npm or yarn

### Development Setup
# Clone the repository
git clone https://github.com/mrtyndall/ArchivePull.git
cd ArchivePull
Install dependencies
npm install
Start the application
npm start

### Building from Source

# Build for current platform
npm run build

# Build for specific platforms
npm run build:win
npm run build:mac
npm run build:linux

## Usage

1. Enter a YouTube URL in the input field
2. Select a destination folder
3. Choose your preferred codec and container format
4. Adjust bitrate settings if needed
5. Click "Download & Transcode"
6. Monitor progress in the status section

## Technical Details

ArchivePull uses:
- Electron for the cross-platform desktop application
- yt-dlp for downloading YouTube videos
- FFmpeg for transcoding to various formats
- Hardware acceleration when available

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) for the excellent YouTube download capabilities
- [FFmpeg](https://ffmpeg.org/) for the powerful transcoding engine
- [Electron](https://www.electronjs.org/) for making cross-platform desktop apps easy to build
