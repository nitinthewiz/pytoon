'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const NEWS_JSON = path.join(__dirname, 'news.json');
const SPEECH_TXT = path.join(__dirname, 'speech.txt');
const AUDIO_FILE = path.join(__dirname, 'speech.mp3');
const OUTPUT_VIDEO = path.join(__dirname, 'background_video.mp4');
const IMAGE_DIR = path.join(__dirname, 'remotion', 'public', 'images');
const PROPS_FILE = path.join(__dirname, 'render-props.json');

const FPS = 30;
const TRANSITION_FRAMES = 15;

async function main() {
  if (!fs.existsSync(NEWS_JSON) || !fs.existsSync(SPEECH_TXT)) {
    console.log('news.json or speech.txt not found — using existing background_video.mp4');
    return;
  }

  const newsItems = JSON.parse(fs.readFileSync(NEWS_JSON, 'utf8'));
  const speechText = fs.readFileSync(SPEECH_TXT, 'utf8');

  const segments = speechText.split('[ITEM]').map(s => s.trim()).filter(Boolean);

  if (segments.length === 0 || newsItems.length === 0) {
    console.log('No segments or news items — using existing background_video.mp4');
    return;
  }

  const totalDuration = getAudioDuration(AUDIO_FILE);
  if (!totalDuration) {
    console.log('Could not read audio duration — using existing background_video.mp4');
    return;
  }

  const count = Math.min(segments.length, newsItems.length);
  const wordCounts = segments.slice(0, count).map(s => s.split(/\s+/).filter(Boolean).length);
  const totalWords = wordCounts.reduce((a, b) => a + b, 0);

  // Compensate for transition overlaps so the video matches audio length
  const totalTransitionFrames = Math.max(0, count - 1) * TRANSITION_FRAMES;
  const availableFrames = Math.ceil(totalDuration * FPS) + totalTransitionFrames;

  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  const items = [];
  for (let i = 0; i < count; i++) {
    const newsItem = newsItems[i];
    if (!newsItem.image) continue;

    const ext = detectExtension(newsItem.image);
    const localName = `images/${i}${ext}`;
    const localPath = path.join(IMAGE_DIR, `${i}${ext}`);

    try {
      console.log(`Downloading image ${i + 1}/${count}: ${newsItem.image}`);
      await downloadImage(newsItem.image, localPath);
    } catch (err) {
      console.warn(`  Failed to download image ${i}: ${err.message} — skipping`);
      continue;
    }

    const durationInFrames = Math.max(FPS, Math.round((wordCounts[i] / totalWords) * availableFrames));
    items.push({ imagePath: localName, durationInFrames });
  }

  if (items.length === 0) {
    console.log('No images downloaded successfully — using existing background_video.mp4');
    return;
  }

  fs.writeFileSync(PROPS_FILE, JSON.stringify({ items }, null, 2));

  console.log(`Rendering background video: ${items.length} images, ~${totalDuration.toFixed(1)}s`);
  execSync(
    `npx remotion render src/index.tsx NewsSlideshow ../background_video.mp4 --props=../render-props.json --overwrite`,
    { cwd: path.join(__dirname, 'remotion'), stdio: 'inherit' }
  );

  console.log('Background video created.');
}

function getAudioDuration(audioPath) {
  const result = spawnSync('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    audioPath,
  ], { encoding: 'utf8' });

  if (result.status !== 0) return null;
  try {
    return parseFloat(JSON.parse(result.stdout).format.duration);
  } catch {
    return null;
  }
}

function detectExtension(url) {
  if (/\.webp/i.test(url)) return '.webp';
  if (/\.png/i.test(url)) return '.png';
  if (/\.jpe?g/i.test(url)) return '.jpg';
  return '.jpg';
}

async function downloadImage(url, dest) {
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(buffer));
}

main().catch(err => {
  console.error('build_background.js failed:', err.message);
  process.exit(1);
});
