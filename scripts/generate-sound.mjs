// Erzeugt einen kurzen, dezenten Zwei-Ton-Hinweiston (WAV, PCM 16-bit) prozedural, ohne externe
// Deps/Assets. WAV statt MP3, weil ohne ffmpeg im Toolchain keine MP3-Encodierung ohne zusätzliche
// Abhängigkeit möglich ist - <audio> spielt WAV in Firefox/Chrome gleichermaßen problemlos ab.
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "sound");
mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 44100;

function tone(freq, startSec, durSec, amp) {
  const samples = Math.round(durSec * SAMPLE_RATE);
  const out = new Float32Array(samples);
  const attack = Math.round(samples * 0.08);
  const release = Math.round(samples * 0.35);
  for (let i = 0; i < samples; i++) {
    let envelope = 1;
    if (i < attack) envelope = i / attack;
    else if (i > samples - release) envelope = (samples - i) / release;
    out[i] = Math.sin(2 * Math.PI * freq * (i / SAMPLE_RATE)) * amp * envelope;
  }
  return out;
}

// Zwei kurze, aufsteigende Töne wie eine dezente "Ding-Dong"-Benachrichtigung.
const noteA = tone(880, 0, 0.14, 0.5);
const noteB = tone(1318.5, 0, 0.22, 0.45);
const gap = Math.round(0.05 * SAMPLE_RATE);
const totalSamples = noteA.length + gap + noteB.length;
const pcm = new Float32Array(totalSamples);
pcm.set(noteA, 0);
pcm.set(noteB, noteA.length + gap);

const buf = Buffer.alloc(totalSamples * 2);
for (let i = 0; i < totalSamples; i++) {
  const s = Math.max(-1, Math.min(1, pcm[i]));
  buf.writeInt16LE(Math.round(s * 32767), i * 2);
}

function wavHeader(dataLength) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataLength, 40);
  return header;
}

const outFile = path.join(outDir, "notify.wav");
writeFileSync(outFile, Buffer.concat([wavHeader(buf.length), buf]));
console.log(outFile);
