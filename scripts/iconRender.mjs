// Zeichnet das rot-weiße Briefumschlag-Icon prozedural (kein externes Asset, kein Google-Logo -
// siehe Trademark-Hinweis in generate-icons.mjs) und kodiert es als PNG, ohne externe Deps (nur
// node:zlib). Geteilt zwischen generate-icons.mjs (Extension-Icons) und generate-docs-icons.mjs
// (Favicon/Logo für die docs/-Landingpage) - dieselbe Zeichnung, nur andere Zielgrößen.
import { deflateSync } from "node:zlib";

const BG = [219, 68, 55, 255]; // Gmail-rot (#DB4437)
const FG = [255, 255, 255, 255]; // weiß

function crc32(buf) {
  let c;
  const table =
    crc32.table ||
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

export function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = deflateSync(raw);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

// Rundrechteck-Test (Ecken als Viertelkreise, Mittelband exakt).
function insideRoundedSquare(x, y, size, radius) {
  const inXBand = x >= radius && x <= size - radius;
  const inYBand = y >= radius && y <= size - radius;
  if (inXBand || inYBand) return true;
  const cx = x < radius ? radius : size - radius;
  const cy = y < radius ? radius : size - radius;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  const projX = ax + t * abx;
  const projY = ay + t * aby;
  return Math.hypot(px - projX, py - projY);
}

// Briefumschlag: breites weißes Rechteck mit abgerundeten Ecken + Klappe (zwei Faltlinien von den
// oberen Ecken zu einem Punkt knapp unterhalb der Rechteck-Oberkante), Proportionen an bekannte
// Mail-Icons angelehnt, aber eigenständig gezeichnet.
function envelopeGeometry(size) {
  const left = size * 0.14;
  const right = size * 0.86;
  const top = size * 0.29;
  const bottom = size * 0.71;
  const cornerRadius = size * 0.045;
  const apexX = (left + right) / 2;
  const apexY = top + (bottom - top) * 0.42;
  return { left, right, top, bottom, cornerRadius, apexX, apexY };
}

function insideEnvelope(x, y, geo) {
  const { left, right, top, bottom, cornerRadius: r } = geo;
  const w = right - left;
  const h = bottom - top;
  const lx = x - left;
  const ly = y - top;
  if (lx < 0 || lx > w || ly < 0 || ly > h) return false;
  const inXBand = lx >= r && lx <= w - r;
  const inYBand = ly >= r && ly <= h - r;
  if (inXBand || inYBand) return true;
  const cx = lx < r ? r : w - r;
  const cy = ly < r ? r : h - r;
  const dx = lx - cx;
  const dy = ly - cy;
  return dx * dx + dy * dy <= r * r;
}

function onFlapLine(x, y, geo, thickness) {
  const { left, right, top, apexX, apexY } = geo;
  return (
    distToSegment(x, y, left, top, apexX, apexY) < thickness ||
    distToSegment(x, y, right, top, apexX, apexY) < thickness
  );
}

function pixelColor(x, y, size, geo, flapThickness) {
  if (!insideRoundedSquare(x, y, size, size * 0.22)) return null; // außerhalb des Icons: transparent
  if (insideEnvelope(x, y, geo) && !onFlapLine(x, y, geo, flapThickness)) return FG;
  return BG;
}

export function renderIcon(size) {
  const SS = 4; // 4x-Supersampling für weiche Kanten
  const geo = envelopeGeometry(size);
  const flapThickness = Math.max(size * 0.045, 0.9);
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          const color = pixelColor(px, py, size, geo, flapThickness);
          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += color[3];
          }
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const coverage = a / (255 * n);
      rgba[i] = coverage > 0 ? Math.round(r / n / coverage) : 0;
      rgba[i + 1] = coverage > 0 ? Math.round(g / n / coverage) : 0;
      rgba[i + 2] = coverage > 0 ? Math.round(b / n / coverage) : 0;
      rgba[i + 3] = Math.round(a / n);
    }
  }
  return rgba;
}

export function renderIconPng(size) {
  return encodePng(size, size, renderIcon(size));
}
