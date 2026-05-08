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

  // Split on [ITEM]. If speech starts with intro text before the first [ITEM],
  // segments[0] is that intro — it should show a blank slide, not a news image.
  const allSegments = speechText.split('[ITEM]').map(s => s.trim()).filter(Boolean);

  const hasIntro = !speechText.trimStart().startsWith('[ITEM]');
  const introSegment = hasIntro ? allSegments[0] : null;
  const storySegments = hasIntro ? allSegments.slice(1) : allSegments;

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

    const durationInFrames = Math.max(FPS, Math.round((storyWordCounts[i] / totalWords) * availableFrames));
    items.push({ imagePath: localName, durationInFrames });
  }

  if (items.length === 0) {
    console.log('No images downloaded successfully — using existing background_video.mp4');
    return;
  }

  const captions = buildCaptionsFromText(speechText, totalDuration * 1000);

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
    `npx remotion render src/index.tsx CaptionsOverlay ../captions_overlay.webm ${renderFlags} --transparent --codec=vp9`,
    { cwd: remotionDir, stdio: 'inherit' }
  );

  console.log('Background video and captions overlay created.');
}

function buildCaptionsFromText(text, totalDurationMs) {
  const clean = text.replace(/\[ITEM\]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ').filter(Boolean);
  if (words.length === 0) return [];

  const msPerWord = totalDurationMs / words.length;
  return words.map((word, i) => ({
    text: i === 0 ? word : ` ${word}`,
    startMs: i * msPerWord,
    endMs: (i + 1) * msPerWord,
    timestampMs: (i + 0.5) * msPerWord,
    confidence: 1,
  }));
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
