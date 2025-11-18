#!/usr/bin/env node
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { PNG } = require('pngjs');

const SIZES = [16, 32, 48, 128];
const OUT_DIR = path.resolve(__dirname, '..', 'icons');

const COLORS = {
  backgroundTop: hexToRgb('#fffdf7'),
  backgroundBottom: hexToRgb('#fef3c7'),
  stripeLight: hexToRgb('#fde047'),
  stripeDark: hexToRgb('#f59e0b'),
  nib: hexToRgb('#7c3aed'),
  nibAccent: hexToRgb('#a855f7'),
  border: hexToRgb('#f4ca64')
};

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
    a: 255
  };
}

function mix(a, b, t) {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
    a: 255
  };
}

function setPixel(png, x, y, color) {
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color.r;
  png.data[idx + 1] = color.g;
  png.data[idx + 2] = color.b;
  png.data[idx + 3] = color.a;
}

function overlay(png, x, y, color, alpha) {
  const idx = (png.width * y + x) << 2;
  const inv = 1 - alpha;
  png.data[idx] = Math.round(color.r * alpha + png.data[idx] * inv);
  png.data[idx + 1] = Math.round(color.g * alpha + png.data[idx + 1] * inv);
  png.data[idx + 2] = Math.round(color.b * alpha + png.data[idx + 2] * inv);
  png.data[idx + 3] = 255;
}

function drawStripe(png) {
  const dir = normalize({ x: 1, y: -0.4 });
  const normal = { x: -dir.y, y: dir.x };
  const center = { x: png.width * 0.2, y: png.height * 0.8 };
  const halfWidth = png.width * 0.18;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const point = { x: x + 0.5, y: y + 0.5 };
      const rel = { x: point.x - center.x, y: point.y - center.y };
      const distance = (rel.x * normal.x + rel.y * normal.y);
      if (Math.abs(distance) <= halfWidth) {
        const along = (rel.x * dir.x + rel.y * dir.y) / (png.width * 0.9);
        const t = Math.min(Math.max(along + 0.5, 0), 1);
        const color = mix(COLORS.stripeDark, COLORS.stripeLight, t);
        overlay(png, x, y, color, 0.92);
      }
    }
  }
}

function drawNib(png) {
  const nibWidth = png.width * 0.38;
  const nibHeight = png.height * 0.28;
  const baseX = Math.round(png.width * 0.48);
  const baseY = Math.round(png.height * 0.58);
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (x < baseX || x > baseX + nibWidth) continue;
      if (y < baseY || y > baseY + nibHeight) continue;
      const relX = (x - baseX) / nibWidth;
      const taper = 1 - relX * 0.4;
      const relY = (y - baseY) / nibHeight;
      const bottom = relY * taper;
      if (relY <= 1 && relY >= 0 && relY <= taper) {
        const color = mix(COLORS.nibAccent, COLORS.nib, relY);
        overlay(png, x, y, color, 0.95);
      }
    }
  }
  // nib tip
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const tipCenter = { x: baseX + nibWidth + png.width * 0.08, y: baseY + nibHeight * 0.7 };
      const dx = (x + 0.5) - tipCenter.x;
      const dy = (y + 0.5) - tipCenter.y;
      const radius = png.width * 0.09;
      if (dx * dx + dy * dy <= radius * radius) {
        overlay(png, x, y, COLORS.nib, 0.95);
      }
    }
  }
}

function drawBorder(png) {
  const thickness = Math.max(1, Math.round(png.width * 0.04));
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      if (x < thickness || y < thickness || x >= png.width - thickness || y >= png.height - thickness) {
        overlay(png, x, y, COLORS.border, 0.35);
      }
    }
  }
}

function drawSparkle(png) {
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const relX = x / png.width;
      const relY = y / png.height;
      const diag = Math.abs(relY - (1 - relX));
      if (diag < 0.02 && relX > 0.5) {
        overlay(png, x, y, { r: 255, g: 255, b: 255, a: 255 }, 0.6);
      }
    }
  }
}

function normalize(vec) {
  const length = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
  return { x: vec.x / length, y: vec.y / length };
}

function createIcon(size) {
  const png = new PNG({ width: size, height: size, filterType: -1 });
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const bg = mix(COLORS.backgroundTop, COLORS.backgroundBottom, t);
    for (let x = 0; x < size; x++) {
      setPixel(png, x, y, bg);
    }
  }
  drawStripe(png);
  drawNib(png);
  drawBorder(png);
  drawSparkle(png);
  return png;
}

function ensureOutDir() {
  mkdirSync(OUT_DIR, { recursive: true });
}

function main() {
  ensureOutDir();
  for (const size of SIZES) {
    const png = createIcon(size);
    const buffer = PNG.sync.write(png);
    const filePath = path.join(OUT_DIR, `icon${size}.png`);
    writeFileSync(filePath, buffer);
    console.log(`Created ${filePath}`);
  }
}

main();
