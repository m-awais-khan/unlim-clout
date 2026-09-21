import React from 'react';

/**
 * Categorize a file by its extension into Google Drive media types
 */
export function getFileCategory(filename = '') {
  if (!filename || typeof filename !== 'string') {
    return 'generic';
  }
  const ext = filename.split('.').pop().toLowerCase().trim();

  // Video extensions
  if (['mp4', 'mkv', 'mov', 'avi', 'webm', 'flv', 'wmv', 'm4v', '3gp', 'ts', 'mpg', 'mpeg', 'vob', 'ogv'].includes(ext)) {
    return 'video';
  }
  // PDF
  if (ext === 'pdf') {
    return 'pdf';
  }
  // Audio extensions
  if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus', 'aiff', 'alac', 'mid', 'midi'].includes(ext)) {
    return 'audio';
  }
  // Image extensions
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif', 'psd', 'ai'].includes(ext)) {
    return 'image';
  }
  // Spreadsheet extensions
  if (['xls', 'xlsx', 'csv', 'ods', 'tsv', 'xlsm', 'numbers'].includes(ext)) {
    return 'spreadsheet';
  }
  // Presentation extensions
  if (['ppt', 'pptx', 'odp', 'key', 'pps', 'ppsx'].includes(ext)) {
    return 'presentation';
  }
  // Document extensions
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages', 'tex', 'log', 'epub'].includes(ext)) {
    return 'document';
  }
  // Archive extensions
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'tgz', 'zst'].includes(ext)) {
    return 'archive';
  }
  // Code extensions
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'htm', 'css', 'scss', 'json', 'xml', 'sql', 'sh', 'bash', 'c', 'cpp', 'h', 'hpp', 'cs', 'java', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'yaml', 'yml', 'env', 'vue', 'svelte'].includes(ext)) {
    return 'code';
  }

  return 'generic';
}

/**
 * Google Drive Authentic File Type Icon Component
 */
export default function FileIcon({ filename = '', name = '', size = 20, className = '' }) {
  const targetName = filename || name || '';
  const category = getFileCategory(targetName);

  // Coral / Red (#EE675C) for PDF, Video, Audio, Image (matching Google Drive)
  const coral = '#EE675C';
  // Blue (#8AB4F8) for Docs, Code, Archive
  const blue = '#8AB4F8';
  // Green (#81C995) for Sheets
  const green = '#81C995';
  // Yellow (#FDD663) for Slides
  const yellow = '#FDD663';
  // Cutout color (dark background of icon cutouts: #1E1F20)
  const cutout = '#131314';

  switch (category) {
    case 'pdf':
      // Google Drive PDF badge: coral rounded rectangle with bold white "PDF"
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="PDF file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={coral} />
          <text
            x="12"
            y="15"
            fill={cutout}
            fontSize="8"
            fontWeight="900"
            fontFamily="Arial, Helvetica, sans-serif"
            textAnchor="middle"
            letterSpacing="-0.5"
          >
            PDF
          </text>
        </svg>
      );

    case 'video':
      // Google Drive Video: coral rounded rectangle with clapperboard top cutout
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Video file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={coral} />
          {/* Clapperboard notches */}
          <path
            d="M5.5 3.5 L7.5 7.5 M10.5 3.5 L12.5 7.5 M15.5 3.5 L17.5 7.5"
            stroke={cutout}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <line x1="2" y1="7.5" x2="22" y2="7.5" stroke={cutout} strokeWidth="1.5" />
          {/* Center Play Button */}
          <polygon points="10,10.5 10,17 15.5,13.75" fill={cutout} />
        </svg>
      );

    case 'audio':
      // Google Drive Audio: coral rounded rectangle with headphones cutout
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Audio file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={coral} />
          {/* Headphones Headband */}
          <path
            d="M7 13.5 v-1.5 a5 5 0 0 1 10 0 v1.5"
            fill="none"
            stroke={cutout}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Left Earcup */}
          <rect x="5.5" y="12" width="3" height="5" rx="1.2" fill={cutout} />
          {/* Right Earcup */}
          <rect x="15.5" y="12" width="3" height="5" rx="1.2" fill={cutout} />
        </svg>
      );

    case 'image':
      // Google Drive Image: coral rounded rectangle with mountain peak scenery
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Image file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={coral} />
          {/* Mountain Peaks Cutout */}
          <path
            d="M5 16.5 L9.5 10.5 L13 14.5 L15.5 11.5 L19 16.5 Z"
            fill={cutout}
          />
        </svg>
      );

    case 'spreadsheet':
      // Google Sheets: green rounded rectangle with table cross cutout
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Spreadsheet file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={green} />
          {/* Table Grid Cross */}
          <line x1="12" y1="6" x2="12" y2="18" stroke={cutout} strokeWidth="2.2" strokeLinecap="round" />
          <line x1="5" y1="10.5" x2="19" y2="10.5" stroke={cutout} strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      );

    case 'presentation':
      // Google Slides: yellow rounded rectangle with slide rectangle cutout
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Presentation file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={yellow} />
          {/* Slide Frame Cutout */}
          <rect x="6" y="8" width="12" height="8" rx="1" fill={cutout} />
        </svg>
      );

    case 'document':
      // Google Docs: blue rounded rectangle with horizontal text lines
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Document file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={blue} />
          {/* Document Lines Cutout */}
          <rect x="6.5" y="7.5" width="11" height="2" rx="1" fill={cutout} />
          <rect x="6.5" y="11" width="11" height="2" rx="1" fill={cutout} />
          <rect x="6.5" y="14.5" width="6.5" height="2" rx="1" fill={cutout} />
        </svg>
      );

    case 'archive':
      // Google Drive Archive: blue rounded rectangle with zipper/download box
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Archive file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={blue} />
          {/* Archive / Zipper Icon Cutout */}
          <path
            d="M7 8h10M7 11h10M12 11v5m0 0l-2-2m2 2l2-2"
            stroke={cutout}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    case 'code':
      // Google Drive Code: blue rounded rectangle with code brackets cutout
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="Code file"
        >
          <rect x="2" y="3.5" width="20" height="17" rx="3.5" fill={blue} />
          {/* < / > code brackets */}
          <path
            d="M9 9.5l-3 2.5 3 2.5M15 9.5l3 2.5-3 2.5"
            stroke={cutout}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );

    default:
      // Generic file icon: Google Drive neutral document
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={`flex-shrink-0 select-none ${className}`}
          aria-label="File"
        >
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            fill="#3C4043"
          />
          <polyline points="14 2 14 8 20 8" fill="#5F6368" />
          <line x1="16" y1="13" x2="8" y2="13" stroke="#9AA0A6" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="17" x2="8" y2="17" stroke="#9AA0A6" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
  }
}
