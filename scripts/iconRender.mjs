// Zeichnet das rot-weiße Briefumschlag-Icon (Lucide "mail") prozedural (kein externes Asset, kein Google-Logo -
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

// Lucide "mail" (https://lucide.dev/icons/mail, ISC-Lizenz): 24x24-Raster, Stroke 2, runde Enden.
//   <rect x="2" y="4" width="20" height="16" rx="2"/>
//   <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/>
// Hier als Signed-Distance-Zeichnung nachgebaut: roter Umschlag mit dünner weißer Klappe auf
// weißem Hintergrund.
const STROKE_R = 0.5; // halbe Strichstärke (Lucide-Standard: 2 -> hier 1)

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

// Klappen-Polylinie: (22,7) -> (13.009,12.727) -> unterer Halbkreis (r≈1) -> (11,12.727) -> (2,7).
const FLAP = (() => {
  const pts = [[22, 7], [13.009, 12.727]];
  const cx = 12.0045;
  const cy = 12.727;
  const r = 1.0045;
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI; // 0 = rechts, π = links, über die Unterseite
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  pts.push([11, 12.727], [2, 7]);
  return pts;
})();

// Vorzeichenbehaftete Distanz zum Rundrechteck (x 2..22, y 4..20, rx 2); negativ = innen.
function rectSdf(x, y) {
  const qx = Math.abs(x - 12) - (10 - 2);
  const qy = Math.abs(y - 12) - (8 - 2);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 2;
}

// Weißer Rahmen überall gleich breit (RAND): Umschlag mittig, Rahmen = Umschlag + RAND je Seite.
// Der Umschlag ist 5:4, das Icon quadratisch - deshalb ist die weiße Fläche selbst nicht quadratisch,
// oben/unten bleibt transparent.
const ENV_W = 0.8;
const ENV_H = ENV_W * 0.8; // Lucide-Rect: 20 x 16
const RAND = 0.1;
const ENV_LEFT = RAND;
const ENV_TOP = (1 - ENV_H) / 2;
const FRAME_TOP = ENV_TOP - RAND;
const FRAME_BOTTOM = ENV_TOP + ENV_H + RAND;
const FRAME_RADIUS = 0.15;

function insideFrame(u, v) {
  if (v < FRAME_TOP || v > FRAME_BOTTOM) return false;
  const cy = (FRAME_TOP + FRAME_BOTTOM) / 2;
  const dx = Math.max(Math.abs(u - 0.5) - (0.5 - FRAME_RADIUS), 0);
  const dy = Math.max(Math.abs(v - cy) - ((FRAME_BOTTOM - FRAME_TOP) / 2 - FRAME_RADIUS), 0);
  return dx * dx + dy * dy <= FRAME_RADIUS * FRAME_RADIUS;
}

function pixelColor(u, v) {
  if (!insideFrame(u, v)) return null; // außerhalb: transparent
  const lx = 2 + ((u - ENV_LEFT) / ENV_W) * 20;
  const ly = 4 + ((v - ENV_TOP) / ENV_W) * 20;
  if (rectSdf(lx, ly) > 0) return FG;
  for (let i = 0; i < FLAP.length - 1; i++) {
    if (distToSegment(lx, ly, FLAP[i][0], FLAP[i][1], FLAP[i + 1][0], FLAP[i + 1][1]) <= STROKE_R) return FG;
  }
  return BG;
}

export function renderIcon(size) {
  const SS = 4; // 4x-Supersampling für weiche Kanten
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0,
        g = 0,
        b = 0,
        a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const color = pixelColor((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
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
