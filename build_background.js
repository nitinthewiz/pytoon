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
const PRODUCTION_JSON = path.join(__dirname, 'productions', 'daily-news', 'production.json');
const COMPOSITE_JSON = path.join(__dirname, 'composite.json');

const FPS = 30;
const TRANSITION_FRAMES = 15;

// Where the stories scene begins on the Production timeline (seconds). The
// narration audio, pytoon avatar and captions are all offset to this point so
// they line up with the stories scene (after Opening + Headlines play).
function computeStoriesStartSec() {
  const prod = JSON.parse(fs.readFileSync(PRODUCTION_JSON, 'utf8'));
  const pfps = prod.canvas.fps;
  const dur = (t) => (prod.scenes.find((s) => s.type === t) || {}).durationSec || 0;
  const stf = prod.sceneTransition.durationFrames;
  const startFrame =
    Math.round(dur('opening') * pfps) + Math.round(dur('headlines') * pfps) - 2 * stf;
  return { fps: pfps, storiesStartSec: Math.max(0, startFrame) / pfps };
}

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

  // itemCount includes the blank intro slide (if any) + story slides
  const itemCount = count + (hasIntro ? 1 : 0);

  // Compute per-slide durations — use Kokoro timestamps when available for precision,
  // otherwise fall back to word-count proportional estimation.
  const kokoroTimestamps = fs.existsSync(CAPTIONS_JSON)
    ? JSON.parse(fs.readFileSync(CAPTIONS_JSON, 'utf8'))
    : null;

  // activeSegments: the text segments that map to actual slides (intro + stories[0..count-1])
  const activeSegments = [
    ...(hasIntro ? [allSegments[0]] : []),
    ...storySegments.slice(0, count),
  ];
  const segmentDurations = computeSegmentDurations(
    kokoroTimestamps, activeSegments, totalDuration, itemCount
  );
  // segmentDurations[0] = intro (when hasIntro), then stories follow in order

  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  const items = [];
  const introSlotIndex = (hasIntro && allSegments[0].split(/\s+/).filter(Boolean).length > 0) ? 0 : -1;

  // Placeholder for the intro teaser — filled in after story images are downloaded
  if (introSlotIndex === 0) {
    items.push({ imagePath: null, durationInFrames: segmentDurations[0], teaserImages: [] });
  }

  for (let i = 0; i < count; i++) {
    // Use the [ITEM:N] index if present, otherwise fall back to sequential
    const newsIdx = storyNewsIndices[i] != null ? storyNewsIndices[i] : i;
    const clampedIdx = Math.min(newsIdx, newsItems.length - 1);
    const newsItem = newsItems[clampedIdx];
    const durationInFrames = segmentDurations[hasIntro ? i + 1 : i];

    const storyMeta = {
      title: newsItem.title || '',
      source: newsItem.source || '',
      category: newsItem.category || 'Top News',
    };

    if (!newsItem.image) {
      items.push({ imagePath: null, durationInFrames, ...storyMeta });
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
      items.push({ imagePath: null, durationInFrames, ...storyMeta });
      continue;
    }

    items.push({ imagePath: localName, durationInFrames, ...storyMeta });
  }

  // Backfill teaserImages on the intro slide with all successfully downloaded story images
  if (introSlotIndex === 0 && items[0]?.teaserImages != null) {
    items[0].teaserImages = items.slice(1).map(it => it.imagePath).filter(Boolean);
  }

  if (items.length === 0) {
    console.log('No images downloaded successfully — using existing background_video.mp4');
    return;
  }

  const captions = fs.existsSync(CAPTIONS_JSON)
    ? buildCaptionsFromKokoroWithText(JSON.parse(fs.readFileSync(CAPTIONS_JSON, 'utf8')), speechText)
    : buildCaptionsFromText(speechText, totalDuration * 1000);

  fs.writeFileSync(PROPS_FILE, JSON.stringify({ items, captions }, null, 2));

  const remotionDir = path.join(__dirname, 'remotion');
  const renderFlags = '--props=../render-props.json --overwrite';

  console.log(`Rendering Production (full show): ${items.length} story slides, ~${totalDuration.toFixed(1)}s narration`);
  execSync(
    `npx remotion render src/index.tsx Production ../background_video.mp4 ${renderFlags}`,
    { cwd: remotionDir, stdio: 'inherit' }
  );

  console.log('Rendering captions overlay...');
  execSync(
    `npx remotion render src/index.tsx CaptionsOverlay ../captions_overlay.mp4 ${renderFlags}`,
    { cwd: remotionDir, stdio: 'inherit' }
  );

  // Emit the composite timeline so compose.js can stack the layers data-driven.
  const composite = computeStoriesStartSec();
  const storiesFrames =
    items.reduce((s, it) => s + it.durationInFrames, 0) -
    Math.max(0, items.length - 1) * TRANSITION_FRAMES;
  composite.storiesDurationSec = storiesFrames / composite.fps;
  fs.writeFileSync(
    COMPOSITE_JSON,
    JSON.stringify({ ...composite, avatarKey: '0xFF00FF', captionsKey: '0x00FF00' }, null, 2),
  );
  console.log(`Production background + captions created. Stories ${composite.storiesStartSec.toFixed(2)}s–${(composite.storiesStartSec + composite.storiesDurationSec).toFixed(2)}s.`);
}

// Derive per-slide durations from Kokoro word timestamps.
// Uses cumulative word count to map each segment's first word to its token index,
// then measures the actual elapsed time between segment boundaries.
// Falls back to word-count proportional estimation when timestamps are unavailable.
function computeSegmentDurations(timestamps, segments, totalDuration, itemCount) {
  const totalTransitionFrames = Math.max(0, itemCount - 1) * TRANSITION_FRAMES;
  const availableFrames = Math.ceil(totalDuration * FPS) + totalTransitionFrames;

  if (!timestamps || timestamps.length === 0) {
    const totalWords = segments.reduce((s, seg) => s + seg.split(/\s+/).filter(Boolean).length, 0);
    return segments.map(seg => {
      const wc = seg.split(/\s+/).filter(Boolean).length;
      return Math.max(FPS, Math.round((wc / totalWords) * availableFrames));
    });
  }

  // Filter to word tokens (Kokoro emits punctuation as separate tokens)
  const wordTokens = timestamps.filter(t => /\w/.test(t.word));

  // Walk each segment, recording the token index where it starts
  let wordIdx = 0;
  const segStartSecs = segments.map(seg => {
    const startSec = wordTokens[Math.min(wordIdx, wordTokens.length - 1)]?.start_time ?? 0;
    wordIdx += seg.split(/\s+/).filter(Boolean).length;
    return startSec;
  });

  return segStartSecs.map((startSec, i) => {
    const endSec = i + 1 < segStartSecs.length ? segStartSecs[i + 1] : totalDuration;
    const visibleFrames = Math.round((endSec - startSec) * FPS);
    // Add transition overlap frames to every slide except the last so the video
    // duration stays in sync with the audio even while slides crossfade.
    const transitionBonus = i < segments.length - 1 ? TRANSITION_FRAMES : 0;
    return Math.max(FPS, visibleFrames + transitionBonus);
  });
}

// Build captions using original speech text for display (preserving numbers like "2026"
// and punctuation like commas) but Kokoro token timestamps for timing.
//
// Kokoro expands numbers to spoken words ("2026" → "twenty twenty six"), so its tokens
// don't map 1-to-1 with original words. For words containing digits we greedily consume
// Kokoro tokens until the next original word is recognised, spanning all the expansion
// tokens and using their combined start→end as the display timing for that one word.
function buildCaptionsFromKokoroWithText(timestamps, speechText) {
  const clean = speechText.replace(/\[ITEM(?::\d+)?\]/g, ' ').replace(/\s+/g, ' ').trim();
  const origWords = clean.split(' ').filter(Boolean);
  if (origWords.length === 0) return [];

  // Only word tokens (no punctuation) — used purely for timing
  const wordToks = timestamps.filter(t => /\w/.test(t.word));
  if (wordToks.length === 0) return [];

  const result = [];
  let ti = 0;

  for (let wi = 0; wi < origWords.length; wi++) {
    if (ti >= wordToks.length) break;

    const origWord = origWords[wi];
    const startMs = wordToks[ti].start_time * 1000;
    let endMs = wordToks[ti].end_time * 1000;

    if (/\d/.test(origWord) && wi + 1 < origWords.length) {
      // This word contains digits — Kokoro will have expanded it to multiple tokens.
      // Consume tokens until we find the start of the next original word.
      const nextBase = origWords[wi + 1].replace(/[^a-zA-Z]/g, '').toLowerCase();
      const prefixLen = Math.min(nextBase.length, 4);
      ti++;
      // Only greedily consume when the next word has recognisable alpha content.
      // If nextBase is empty (next word is also a digit/punctuation), the while loop
      // would never break and consume every remaining token — killing all captions.
      if (prefixLen >= 2) {
        while (ti < wordToks.length) {
          const tok = wordToks[ti].word.toLowerCase().replace(/[^a-z]/g, '');
          if (tok === nextBase || tok.startsWith(nextBase.slice(0, prefixLen))) break;
          endMs = wordToks[ti].end_time * 1000;
          ti++;
        }
      }
    } else {
      ti++;
    }

    result.push({
      text: wi === 0 ? origWord : ` ${origWord}`,
      startMs,
      endMs,
      timestampMs: (startMs + endMs) / 2,
      confidence: 1,
    });
  }

  return result;
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
