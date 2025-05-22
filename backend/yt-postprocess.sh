#!/bin/bash

input="$1"
base="${input%.*}"
filename="$(basename "$base")"
downloads_dir="$(dirname "$input")"

# Get settings from environment variables
YT_CODEC="${YT_CODEC:-H.264 (GPU)}"
YT_CONTAINER="${YT_CONTAINER:-.mov}"
YT_BITRATE_1080="${YT_BITRATE_1080:-10}"
YT_BITRATE_1440="${YT_BITRATE_1440:-20}"
YT_BITRATE_2160="${YT_BITRATE_2160:-35}"
YT_METADATA="${YT_METADATA:-title,youtube_url,duration,channel,upload_date,description}"
YT_IS_HDR="${YT_IS_HDR:-false}"

echo "Using codec: $YT_CODEC"
echo "Using container: $YT_CONTAINER"
echo "Using bitrates: 1080p=$YT_BITRATE_1080, 1440p=$YT_BITRATE_1440, 2160p=$YT_BITRATE_2160"
echo "Metadata options: $YT_METADATA"

# Load yt-dlp metadata
original_json="${base}.info.json"
title="Unknown_Title"

if [[ -f "$original_json" ]]; then
  title=$(grep -o '"title": *"[^"]*"' "$original_json" | cut -d'"' -f4 | tr -cd '[:alnum:] _-' | tr ' ' '_')
  [[ -z "$title" ]] && title="$filename"
fi

# Create output folders
video_dir="${downloads_dir}/${title}"
mkdir -p "$video_dir"
transcript_dir="${video_dir}/transcript"
mkdir -p "$transcript_dir"

# Extract resolution and frame rate
width=1920
height=1080
fps=30

if command -v ffprobe &> /dev/null; then
  # Get resolution
  resolution=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$input" 2>/dev/null)
  if [[ -n "$resolution" ]]; then
    width=$(echo $resolution | cut -d',' -f1)
    height=$(echo $resolution | cut -d',' -f2)
  fi
  
  # Get frame rate
  framerate=$(ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$input" 2>/dev/null)
  if [[ -n "$framerate" ]]; then
    # Convert fraction to decimal (e.g., 30000/1001 to ~29.97)
    if [[ $framerate == *"/"* ]]; then
      num=$(echo $framerate | cut -d'/' -f1)
      den=$(echo $framerate | cut -d'/' -f2)
      fps=$(echo "scale=2; $num / $den" | bc)
    else
      fps=$framerate
    fi
  fi
fi

# Determine if high frame rate (>30fps)
is_high_fps=false
if (( $(echo "$fps > 30" | bc -l) )); then
  is_high_fps=true
fi

# Set bitrate based on resolution, frame rate, and HDR setting
is_hdr="${YT_IS_HDR:-false}"

if [[ $height -ge 4320 ]]; then # 8K
  if [[ "$is_high_fps" == "true" ]]; then
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_8K_HIGH:-180}M"
    else
      bitrate="${YT_BITRATE_8K_HIGH:-180}M"
    fi
  else
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_8K_STANDARD:-120}M"
    else
      bitrate="${YT_BITRATE_8K_STANDARD:-120}M"
    fi
  fi
elif [[ $height -ge 2160 ]]; then # 4K
  if [[ "$is_high_fps" == "true" ]]; then
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_4K_HIGH:-66}M"
    else
      bitrate="${YT_BITRATE_4K_HIGH:-60}M"
    fi
  else
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_4K_STANDARD:-44}M"
    else
      bitrate="${YT_BITRATE_4K_STANDARD:-40}M"
    fi
  fi
elif [[ $height -ge 1440 ]]; then # 1440p
  if [[ "$is_high_fps" == "true" ]]; then
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_1440P_HIGH:-30}M"
    else
      bitrate="${YT_BITRATE_1440P_HIGH:-24}M"
    fi
  else
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_1440P_STANDARD:-20}M"
    else
      bitrate="${YT_BITRATE_1440P_STANDARD:-16}M"
    fi
  fi
else # 1080p and below
  if [[ "$is_high_fps" == "true" ]]; then
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_1080P_HIGH:-15}M"
    else
      bitrate="${YT_BITRATE_1080P_HIGH:-12}M"
    fi
  else
    if [[ "$is_hdr" == "true" ]]; then
      bitrate="${YT_BITRATE_1080P_STANDARD:-10}M"
    else
      bitrate="${YT_BITRATE_1080P_STANDARD:-8}M"
    fi
  fi
fi

echo "Video resolution: ${width}x${height}, Frame rate: ${fps}fps"
echo "Using bitrate: $bitrate (HDR: $is_hdr, High FPS: $is_high_fps)"

# Determine codec parameters based on user selection
case "$YT_CODEC" in
  "H.264 (GPU)")
    codec_params="-c:v h264_videotoolbox -b:v $bitrate"
    ;;
  "H.264 (CPU)")
    codec_params="-c:v libx264 -preset slow -crf 18 -b:v $bitrate"
    ;;
  "H.265 (GPU)")
    codec_params="-c:v hevc_videotoolbox -b:v $bitrate"
    ;;
  "H.265 (CPU)")
    codec_params="-c:v libx265 -preset medium -crf 23 -b:v $bitrate"
    ;;
  "ProRes 422")
    codec_params="-c:v prores_ks -profile:v 2 -qscale:v 5"
    ;;
  "ProRes 422 HQ")
    codec_params="-c:v prores_ks -profile:v 3 -qscale:v 9"
    ;;
  "ProRes 422 LT")
    codec_params="-c:v prores_ks -profile:v 1 -qscale:v 4"
    ;;
  "ProRes 4444")
    codec_params="-c:v prores_ks -profile:v 4 -qscale:v 11"
    ;;
  "DNxHD")
    # Determine DNxHD profile based on resolution
    if [[ $height -ge 2160 ]]; then
      codec_params="-c:v dnxhd -profile:v dnxhr_hq -b:v 800M"
    elif [[ $height -ge 1080 ]]; then
      codec_params="-c:v dnxhd -profile:v dnxhr_hq -b:v 185M"
    else
      codec_params="-c:v dnxhd -profile:v dnxhr_sq -b:v 120M"
    fi
    ;;
  "AV1")
    codec_params="-c:v libaom-av1 -crf 30 -b:v $bitrate -strict experimental"
    ;;
  *)
    codec_params="-c:v h264_videotoolbox -b:v $bitrate"
    ;;
esac

# Set output extension based on container format
output_ext="${YT_CONTAINER#.}"
output_file="${video_dir}/${filename}.${output_ext}"

# Transcode to selected format
echo "📼 Transcoding $input → $output_file with codec $YT_CODEC at bitrate $bitrate..."

if command -v ffmpeg &> /dev/null; then
  ffmpeg -y -i "$input" \
    $codec_params \
    -c:a aac -b:a 192k \
    "$output_file"

  # Cleanup if successful
  if [[ -f "$output_file" ]]; then
    echo "✅ Transcode complete. Removing original .mkv."
    rm "$input"
  else
    echo "⚠️ Transcode failed. Keeping .mkv."
  fi
else
  echo "⚠️ ffmpeg not found. Cannot transcode."
  # Just move the file instead
  mv "$input" "${video_dir}/${filename}.mkv"
fi

# ---- Subtitle Handling ----
caption_vtt="${base}.en.vtt"
caption_srt="${base}.en.srt"
target_srt="${transcript_dir}/${filename}.srt"

if [[ -f "$caption_vtt" ]]; then
  echo "📝 Converting .vtt to .srt..."
  if command -v ffmpeg &> /dev/null; then
    ffmpeg -y -i "$caption_vtt" "$target_srt"
    rm "$caption_vtt"
  else
    mv "$caption_vtt" "${transcript_dir}/${filename}.vtt"
  fi
elif [[ -f "$caption_srt" ]]; then
  echo "📁 Moving existing .srt to transcript folder..."
  mv "$caption_srt" "$target_srt"
else
  echo "⚠️ No subtitles found."
fi

# ---- Simplified Metadata ----
if [[ -f "$original_json" ]]; then
  echo "📄 Writing simplified metadata..."
  
  # Create a simple metadata file
  meta_file="${video_dir}/${filename}_metadata.txt"
  
  echo "# Video Metadata" > "$meta_file"
  echo "-------------------" >> "$meta_file"
  
  # Extract metadata based on user selections
  if [[ "$YT_METADATA" == *"title"* ]]; then
    title=$(grep -o '"title": *"[^"]*"' "$original_json" | cut -d'"' -f4)
    echo "Title: $title" >> "$meta_file"
  fi
  
  if [[ "$YT_METADATA" == *"youtube_url"* ]]; then
    url=$(grep -o '"webpage_url": *"[^"]*"' "$original_json" | cut -d'"' -f4)
    echo "YouTube URL: $url" >> "$meta_file"
  fi
  
  if [[ "$YT_METADATA" == *"duration"* ]]; then
    # More robust duration extraction
    duration=$(grep -o '"duration": *[0-9.]*' "$original_json" | head -1 | sed 's/.*: *//')
    if [[ -n "$duration" ]]; then
      # Convert to integer if it's a decimal
      duration=${duration%.*}
      minutes=$((duration / 60))
      seconds=$((duration % 60))
      echo "Duration: ${minutes}m ${seconds}s" >> "$meta_file"
    else
      echo "Duration: Unknown" >> "$meta_file"
    fi
  fi
  
  if [[ "$YT_METADATA" == *"channel"* ]]; then
    channel=$(grep -o '"uploader": *"[^"]*"' "$original_json" | cut -d'"' -f4)
    echo "Channel: $channel" >> "$meta_file"
  fi
  
  if [[ "$YT_METADATA" == *"upload_date"* ]]; then
    date=$(grep -o '"upload_date": *"[^"]*"' "$original_json" | cut -d'"' -f4)
    # Format date from YYYYMMDD to YYYY-MM-DD
    formatted_date="${date:0:4}-${date:4:2}-${date:6:2}"
    echo "Upload Date: $formatted_date" >> "$meta_file"
  fi
  
  if [[ "$YT_METADATA" == *"description"* ]]; then
    echo "Description:" >> "$meta_file"
    # Extract description more cleanly
    description=$(sed -n '/"description": "/,/",$/p' "$original_json" | sed '1s/.*"description": "//; $s/",.*$//')
    # Only take the actual description part, not the entire JSON that follows
    description=$(echo "$description" | sed 's/\\n/\n/g' | head -n 5)
    echo "$description" >> "$meta_file"
  fi
  
  # Remove the original JSON file
  rm "$original_json"
fi

echo "✅ Processing complete!" 