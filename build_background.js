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
const CAPTIONS_JSON = path.join(__dirname, 'captions.json');

const FPS = 30;
const TRANSITION_FRAMES = 15;

async function main() {
  if (!fs.existsSync(NEWS_JSON) || !fs.existsSync(SPEECH_TXT)) {
    console.log('news.json or speech.txt not found — using existing background_video.mp4');
    return;
  }

  const newsItems = JSON.parse(fs.readFileSync(NEWS_JSON, 'utf8'));
  const speechText = fs.readFileSync(SPEECH_TXT, 'utf8');

  // Split on [ITEM] or [ITEM:N]. If speech starts with intro text before the first marker,
  // segments[0] is that intro — it should show a blank slide, not a news image.
  // [ITEM:N] carries a 1-based index into newsItems so images match even when the LLM
  // reorders or skips stories.
  const ITEM_RE = /\[ITEM(?::(\d+))?\]/g;
  const itemMatches = [...speechText.matchAll(ITEM_RE)];
  // 0-based indices into newsItems; null means fall back to sequential
  const itemNewsIndices = itemMatches.map(m => (m[1] != null ? parseInt(m[1]) - 1 : null));

  const allSegments = speechText.split(/\[ITEM(?::\d+)?\]/).map(s => s.trim()).filter(Boolean);

  const hasIntro = !speechText.trimStart().startsWith('[ITEM');
  const introSegment = hasIntro ? allSegments[0] : null;
  const storySegments = hasIntro ? allSegments.slice(1) : allSegments;
  const storyNewsIndices = itemNewsIndices;

  if (storySegments.length === 0 || newsItems.length === 0) {
    console.log('No story segments or news items — using existing background_video.mp4');
    return;
  }

  const totalDuration = getAudioDuration(AUDIO_FILE);
  if (!totalDuration) {
    console.log('Could not read audio duration — using existing background_video.mp4');
    return;
  }

  const count = Math.min(storySegments.length, newsItems.length);

  // Word counts for ALL segments (intro + stories) to proportion time correctly
  const allWordCounts = allSegments.map(s => s.split(/\s+/).filter(Boolean).length);
  const introWordCount = hasIntro ? allWordCounts[0] : 0;
  const storyWordCounts = hasIntro ? allWordCounts.slice(1, count + 1) : allWordCounts.slice(0, count);
  const totalWords = allWordCounts.reduce((a, b) => a + b, 0);

  // itemCount includes the blank intro slide (if any) + story slides
  const itemCount = count + (hasIntro ? 1 : 0);
  // Compensate for transition overlaps so the video matches audio length
  const totalTransitionFrames = Math.max(0, itemCount - 1) * TRANSITION_FRAMES;
  const availableFrames = Math.ceil(totalDuration * FPS) + totalTransitionFrames;

  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  const items = [];

  // Blank intro slide — shown while the anchor reads the opening/teaser
  if (hasIntro && introWordCount > 0) {
    const introFrames = Math.max(FPS, Math.round((introWordCount / totalWords) * availableFrames));
    items.push({ imagePath: null, durationInFrames: introFrames });
  }

  for (let i = 0; i < count; i++) {
    // Use the [ITEM:N] index if present, otherwise fall back to sequential
    const newsIdx = storyNewsIndices[i] != null ? storyNewsIndices[i] : i;
    const clampedIdx = Math.min(newsIdx, newsItems.length - 1);
    const newsItem = newsItems[clampedIdx];
    const durationInFrames = Math.max(FPS, Math.round((storyWordCounts[i] / totalWords) * availableFrames));

    if (!newsItem.image) {
      items.push({ imagePath: null, durationInFrames });
      continue;
    }

    const ext = detectExtension(newsItem.image);
    const localName = `images/${i}${ext}`;
    const localPath = path.join(IMAGE_DIR, `${i}${ext}`);

    try {
      console.log(`Downloading image ${i + 1}/${count}: ${newsItem.image}`);
      await downloadImage(newsItem.image, localPath);
    } catch (err) {
      console.warn(`  Failed to download image ${i}: ${err.message} — showing blank slide`);
      items.push({ imagePath: null, durationInFrames });
      continue;
    }

    items.push({ imagePath: localName, durationInFrames });
  }

  if (items.length === 0) {
    console.log('No images downloaded successfully — using existing background_video.mp4');
    return;
  }

  const captions = fs.existsSync(CAPTIONS_JSON)
    ? buildCaptionsFromKokoro(JSON.parse(fs.readFileSync(CAPTIONS_JSON, 'utf8')))
    : buildCaptionsFromText(speechText, totalDuration * 1000);

  fs.writeFileSync(PROPS_FILE, JSON.stringify({ items, captions }, null, 2));

  const remotionDir = path.join(__dirname, 'remotion');
  const renderFlags = '--props=../render-props.json --overwrite';

  console.log(`Rendering background video: ${items.length} images, ~${totalDuration.toFixed(1)}s`);
  execSync(
    `npx remotion render src/index.tsx NewsSlideshow ../background_video.mp4 ${renderFlags}`,
    { cwd: remotionDir, stdio: 'inherit' }
  );

  console.log('Rendering captions overlay...');
  execSync(
    `npx remotion render src/index.tsx CaptionsOverlay ../captions_overlay.mp4 ${renderFlags}`,
    { cwd: remotionDir, stdio: 'inherit' }
  );

  console.log('Background video and captions overlay created.');
}

function buildCaptionsFromKokoro(timestamps) {
  // Kokoro returns punctuation as separate tokens — filter to real words only.
  const words = timestamps.filter(t => /\w/.test(t.word));
  return words.map((t, i) => ({
    text: i === 0 ? t.word : ` ${t.word}`,
    startMs: t.start_time * 1000,
    endMs: t.end_time * 1000,
    timestampMs: (t.start_time + t.end_time) / 2 * 1000,
    confidence: 1,
  }));
}

function buildCaptionsFromText(text, totalDurationMs) {
  const clean = text.replace(/\[ITEM(?::\d+)?\]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length === 0) return [];

  // Give extra time to words followed by punctuation to match Kokoro's pause behaviour.
  // Sentence-ending punctuation (.!?) gets a larger bonus than mid-sentence (,:;).
  const units = words.map(w => {
    if (/[.!?]['"]?$/.test(w)) return 1.6;
    if (/[,;:]$/.test(w)) return 1.25;
    return 1;
  });
  const totalUnits = units.reduce((a, b) => a + b, 0);
  const msPerUnit = totalDurationMs / totalUnits;

  let elapsed = 0;
  return words.map((word, i) => {
    const startMs = elapsed;
    elapsed += units[i] * msPerUnit;
    return {
      text: i === 0 ? word : ` ${word}`,
      startMs,
      endMs: elapsed,
      timestampMs: (startMs + elapsed) / 2,
      confidence: 1,
    };
  });
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
