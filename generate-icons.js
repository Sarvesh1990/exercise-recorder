/**
 * Generate simple PNG icons for the PWA.
 * Run: node generate-icons.js
 */
const fs = require('fs');
const path = require('path');

function createPNG(size) {
  // Create a minimal valid PNG with a colored background
  // This creates a simple solid-color PNG that satisfies PWA requirements

  const { createCanvas } = (() => {
    // Fallback: create a 1x1 pixel PNG manually using raw bytes
    return {
      createCanvas: null
    };
  })();

  // Generate a minimal valid PNG (solid purple square)
  // PNG structure: signature + IHDR + IDAT + IEND
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData.writeUInt8(8, 8);        // bit depth
  ihdrData.writeUInt8(2, 9);        // color type (RGB)
  ihdrData.writeUInt8(0, 10);       // compression
  ihdrData.writeUInt8(0, 11);       // filter
  ihdrData.writeUInt8(0, 12);       // interlace

  const ihdr = createChunk('IHDR', ihdrData);

  // Create raw pixel data (purple background #6c63ff)
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      // Simple dumbbell icon area: draw a circle in center
      const cx = size / 2, cy = size / 2;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const radius = size * 0.35;

      if (dist < radius) {
        // White foreground
        rawData.push(255, 255, 255);
      } else {
        // Purple background
        rawData.push(108, 99, 255);
      }
    }
  }

  const rawBuf = Buffer.from(rawData);

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(rawBuf);

  const idat = createChunk('IDAT', compressed);
  const iend = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  const typeBuffer = Buffer.from(type, 'ascii');

  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData));

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

[192, 512].forEach(size => {
  const png = createPNG(size);
  const filePath = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Created ${filePath} (${png.length} bytes)`);
});
