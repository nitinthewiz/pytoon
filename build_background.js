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
function loadProduction() {
  return JSON.parse(fs.readFileSync(PRODUCTION_JSON, 'utf8'));
}

// When the narration (audio + avatar + captions) begins on the show timeline.
// - newshound: narration covers the Headlines scene (intro teases the rundown)
//   and, as a retention hook, starts hookOverlapSec BEFORE the opening hands off
//   (the cold-open line plays over the splash).
// - classic: narration starts at the Stories scene (after Opening + Headlines).
function computeNarrationStartSec(prod, introFrames) {
  const pfps = prod.canvas.fps;
  const theme = prod.theme || 'classic';
  const isNH = theme.startsWith('newshound');
  const dur = (t) => (prod.scenes.find((s) => s.type === t) || {}).durationSec || 0;
  const stf = prod.sceneTransition.durationFrames; // scene-to-scene transition (overlap)
  const openingF = Math.round(dur('opening') * pfps);
  const hookF = isNH ? Math.round((prod.hookOverlapSec || 0) * pfps) : 0;

  // The teaser item carries the intro narration length plus a slide-transition
  // bonus (TRANSITION_FRAMES) baked in by computeSegmentDurations.
  const introNarrFrames = Math.max(0, (introFrames || 0) - TRANSITION_FRAMES);

  // Headlines scene length. MUST mirror headlinesFrames() in
  // remotion/src/themes/newshound/Show.tsx:
  //   headlines = introNarration + 2*stf - hook
  // so that narrationStart = opening - hook AND story-1's narration lands exactly
  // on the Stories scene start (opening + headlines - 2*stf).
  const headFrames = isNH && (introFrames || 0) > 0
    ? Math.max(1, introNarrFrames + 2 * stf - hookF)
    : (introFrames || 0);
  // Where the Stories scene actually begins on the show timeline (2 scene
  // transitions before it overlap, so subtract 2*stf).
  const storiesSceneStart = openingF + headFrames - 2 * stf;

  // newshound* themes: narration covers Headlines (intro) → Stories. Offset it so
  // the FIRST story's narration lands exactly on the Stories scene start; the intro
  // then plays back over the Headlines scene (entering the opening splash by the
  // hook overlap). This keeps every story slide in lockstep with James — no image
  // rolling in before he's done talking.
  // classic: narration just starts at the Stories scene.
  const startFrame = isNH ? storiesSceneStart - introNarrFrames : storiesSceneStart;
  return {
    fps: pfps,
    narrationStartSec: Math.max(0, startFrame) / pfps,
    // frame-level pieces, reused by the scene-timeline emission below
    openingF, headFrames, storiesSceneStartF: storiesSceneStart, stf, isNH,
  };
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

  // Per-story enrichment from the new pipeline (optional — falls back gracefully).
  const loadJson = (f) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
  const takes = loadJson(path.join(__dirname, 'takes.json'));
  const teasers = loadJson(path.join(__dirname, 'teasers.json'));
  const tags = loadJson(path.join(__dirname, 'tags.json'));
  const visualsArr = loadJson(path.join(__dirname, 'visuals.json'));

  // [CLOSE] marks the sign-off → its own Closing scene (so "Thank you…" no longer
  // plays over the last story). Split on both markers; the trailing piece is the close.
  const hasClose = /\[CLOSE\]/.test(speechText);
  const allSegments = speechText.split(/\[ITEM(?::\d+)?\]|\[CLOSE\]/).map(s => s.trim()).filter(Boolean);
  const closingSegment = hasClose ? allSegments[allSegments.length - 1] : null;
  const middleSegments = hasClose ? allSegments.slice(0, -1) : allSegments;

  const hasIntro = !speechText.trimStart().startsWith('[ITEM');
  const introSegment = hasIntro ? middleSegments[0] : null;
  const storySegments = hasIntro ? middleSegments.slice(1) : middleSegments;
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

  // Build word-level captions FIRST (number-expansion aware), then derive slide
  // timing from the same per-original-word time mapping — so slides, captions and
  // narration stay perfectly in lockstep (no drift from "2026" → "twenty twenty-six").
  const kokoroTimestamps = fs.existsSync(CAPTIONS_JSON)
    ? JSON.parse(fs.readFileSync(CAPTIONS_JSON, 'utf8'))
    : null;
  const captions = kokoroTimestamps
    ? buildCaptionsFromKokoroWithText(kokoroTimestamps, speechText)
    : buildCaptionsFromText(speechText, totalDuration * 1000);

  // activeSegments: intro + stories + closing — each maps to a scene/slide.
  const activeSegments = [
    ...(hasIntro ? [middleSegments[0]] : []),
    ...storySegments.slice(0, count),
    ...(hasClose ? [closingSegment] : []),
  ];
  const segmentDurations = computeSegmentDurations(captions, activeSegments, totalDuration);
  // segmentDurations: [intro?, stories…, closing?]. Closing scene = the last entry.
  const closingFrames = hasClose ? segmentDurations[segmentDurations.length - 1] : null;

  fs.mkdirSync(IMAGE_DIR, { recursive: true });

  const items = [];
  const introSlotIndex = (hasIntro && middleSegments[0].split(/\s+/).filter(Boolean).length > 0) ? 0 : -1;

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
      // category badge, chyron take and rundown teaser come from the LLM when present.
      category: (tags && tags[i]) || newsItem.category || 'Top News',
      take: (takes && takes[i]) || undefined,
      teaser: (teasers && teasers[i]) || undefined,
    };
    // Map the LLM's visual beats; fill the 'photo' beat's src with the local image below.
    const rawVisuals = visualsArr && visualsArr[i];

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

    const visuals = rawVisuals && rawVisuals.length
      ? rawVisuals.map(v => v.type === 'photo' ? { ...v, src: localName } : v)
      : undefined;
    items.push({ imagePath: localName, durationInFrames, ...storyMeta, ...(visuals ? { visuals } : {}) });
  }

  // Backfill teaserImages on the intro slide with all successfully downloaded story images
  if (introSlotIndex === 0 && items[0]?.teaserImages != null) {
    items[0].teaserImages = items.slice(1).map(it => it.imagePath).filter(Boolean);
  }

  if (items.length === 0) {
    console.log('No images downloaded successfully — using existing background_video.mp4');
    return;
  }

  // Pick compositions + layout details by the production's theme.
  const prod = loadProduction();
  const theme = prod.theme || 'classic';
  const isNH = theme.startsWith('newshound');
  const bgComp = theme === 'newshound-fb' ? 'NewshoundShowFB' : theme === 'newshound' ? 'NewshoundShow' : 'Production';
  const capComp = isNH ? 'NewshoundCaptions' : 'CaptionsOverlay';
  // Captions sit lower in the fb layout (below the centered presenter).
  const captionTop = theme === 'newshound-fb' ? 1580 : 1500;

  // DEMO visuals (only when the LLM didn't supply visuals.json) — crude title heuristics
  // so the beat renderer is visible locally. Real runs use the passed visuals[].
  if (theme === 'newshound-fb' && !visualsArr) {
    const ISO = { india: 'in', china: 'cn', britain: 'gb', british: 'gb', uk: 'gb', senegal: 'sn', america: 'us', american: 'us', 'san francisco': 'us', france: 'fr', germany: 'de', australia: 'au', russia: 'ru', iran: 'ir', israel: 'il', ukraine: 'ua' };
    for (const it of items) {
      if (it.imagePath == null || it.teaserImages != null) continue; // skip teaser
      const t = (it.title || '').toLowerCase();
      const beats = [{ type: 'photo', src: it.imagePath }];
      const found = Object.keys(ISO).filter(k => t.includes(k));
      const uniq = [...new Set(found.map(k => ISO[k]))];
      if (uniq.length >= 2) beats.push({ type: 'flagclash', a: uniq[0], b: uniq[1], mode: 'cooperate', labelA: found[0].toUpperCase(), labelB: found[1].toUpperCase() });
      const num = (it.title || '').match(/(\d+(?:\.\d+)?)\s*(x|%)/i);
      if (num) beats.push({ type: 'number', value: num[1] + num[2], label: (it.title || '').slice(0, 50) });
      if (beats.length > 1) it.visuals = beats;
    }
  }

  fs.writeFileSync(PROPS_FILE, JSON.stringify({ items, captions, captionTop, closingFrames }, null, 2));

  const remotionDir = path.join(__dirname, 'remotion');
  const renderFlags = '--props=../render-props.json --overwrite';

  console.log(`Rendering ${bgComp} (theme: ${theme}): ${items.length} slides, ~${totalDuration.toFixed(1)}s narration`);
  execSync(
    `npx remotion render src/index.tsx ${bgComp} ../background_video.mp4 ${renderFlags}`,
    { cwd: remotionDir, stdio: 'inherit' }
  );

  console.log('Rendering captions overlay...');
  execSync(
    `npx remotion render src/index.tsx ${capComp} ../captions_overlay.mp4 ${renderFlags}`,
    { cwd: remotionDir, stdio: 'inherit' }
  );

  // Emit the composite timeline so compose.js can stack the layers data-driven.
  // intro narration length (carried on the teaser item) sets where Stories begins
  // and, for the classic theme, the narration offset.
  const introFrames = (items[0] && items[0].imagePath === null && (items[0].teaserImages != null))
    ? items[0].durationInFrames : 0;
  const narration = computeNarrationStartSec(prod, introFrames);
  const composite = {
    fps: narration.fps,
    narrationStartSec: narration.narrationStartSec,
    narrationDurationSec: totalDuration,
    avatarKey: '0xFF00FF',
    captionsKey: '0x00FF00',
  };

  // fb layout: James is a bottom-left "presenter" — crop to James, scale down,
  // place over the image's bottom-left (compose.js applies the transform).
  if (theme === 'newshound-fb') {
    // James as a CENTERED bottom presenter, ~10% bigger than the first pass.
    composite.avatar = { crop: '760:704:160:0', scale: 0.64, x: 297, y: 1078 };
  }

  if (narration.isNH) {
    // --- Scene timeline → compose.js's per-scene audio engine ---------------
    // Times in SECONDS on the FINAL video timeline. Windows include the
    // transition overlaps at both ends (scene cuts overlap by stf frames, story
    // slides by TRANSITION_FRAMES), so adjacent music beds naturally crossfade
    // when each fades in/out at its window edges.
    const { openingF, headFrames, storiesSceneStartF, stf } = narration;
    const f2s = (f) => Number((Math.max(0, f) / narration.fps).toFixed(3));
    const emotions = loadJson(path.join(__dirname, 'emotions.json')) || [];
    const storyItems = items.filter((it) => !(it.imagePath === null && it.teaserImages != null));
    const storiesLenF = Math.max(1, storyItems.reduce((s, it) => s + it.durationInFrames, 0)
      - Math.max(0, storyItems.length - 1) * TRANSITION_FRAMES);
    const closingLenF = closingFrames
      ?? Math.round((((prod.scenes.find((s) => s.type === 'closing') || {}).durationSec) || 0) * narration.fps);

    const scenes = [
      { type: 'opening', start: 0, end: f2s(openingF) },
      { type: 'headlines', start: f2s(openingF - stf), end: f2s(openingF - stf + headFrames) },
    ];
    const storyBoundaries = []; // cut points between consecutive story slides
    let cursorF = storiesSceneStartF;
    storyItems.forEach((it, i) => {
      const last = i === storyItems.length - 1;
      // A story is on screen for its full sequence span; the next story's
      // sequence starts TRANSITION_FRAMES before this one's end (the slide/wipe).
      const endF = last ? storiesSceneStartF + storiesLenF : cursorF + it.durationInFrames;
      scenes.push({ type: 'story', start: f2s(cursorF), end: f2s(endF), emotion: emotions[i] || 'explain' });
      if (!last) {
        cursorF += it.durationInFrames - TRANSITION_FRAMES;
        storyBoundaries.push(f2s(cursorF));
      }
    });
    const closingStartF = storiesSceneStartF + storiesLenF - stf;
    scenes.push({ type: 'closing', start: f2s(closingStartF), end: f2s(closingStartF + closingLenF) });

    composite.scenes = scenes;
    composite.storyBoundaries = storyBoundaries;
    composite.audioSeed = computeAudioSeed(speechText);
  } else {
    // classic theme — single looped music bed (compose.js fallback path)
    composite.music = { file: 'assets/News Background Test.m4a', volume: 0.18 };
  }

  fs.writeFileSync(COMPOSITE_JSON, JSON.stringify(composite, null, 2));
  console.log(`${bgComp} + captions created. Narration ${composite.narrationStartSec.toFixed(2)}s–${(composite.narrationStartSec + composite.narrationDurationSec).toFixed(2)}s.`);
}

// Deterministic per-run seed for music-variant rotation: simple charcode sum of
// the manifest's video_key (runner) or the speech text (local fallback). Same
// inputs → same variants; different editions → rotated variants.
function computeAudioSeed(speechText) {
  let s = '';
  try {
    const m = JSON.parse(fs.readFileSync(path.join(__dirname, 'manifest.json'), 'utf8'));
    s = String(m.video_key || m.audio || '');
  } catch { /* no manifest on local runs */ }
  if (!s) s = String(speechText || '');
  let sum = 0;
  for (let i = 0; i < s.length; i++) sum = (sum + s.charCodeAt(i)) % 1000003;
  return sum;
}

// Derive per-slide durations from the per-original-word captions array (built by
// buildCaptionsFromKokoroWithText, so it already handles number-expansion drift).
// Each segment's first word maps 1:1 to a caption entry, giving an exact start
// time — the same mapping the on-screen captions use, so slides never drift from
// the narration. Falls back to word-count proportions when captions are empty.
function computeSegmentDurations(captions, segments, totalDuration) {
  if (!captions || captions.length === 0) {
    const availableFrames = Math.ceil(totalDuration * FPS) + Math.max(0, segments.length - 1) * TRANSITION_FRAMES;
    const totalWords = segments.reduce((s, seg) => s + seg.split(/\s+/).filter(Boolean).length, 0) || 1;
    return segments.map(seg => {
      const wc = seg.split(/\s+/).filter(Boolean).length;
      return Math.max(FPS, Math.round((wc / totalWords) * availableFrames));
    });
  }

  // captions[i] corresponds to the i-th original (cleaned-text) word, in order.
  let wordIdx = 0;
  const segStartSecs = segments.map(seg => {
    const c = captions[Math.min(wordIdx, captions.length - 1)];
    const startSec = c ? c.startMs / 1000 : 0;
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
  const clean = speechText.replace(/\[(?:ITEM(?::\d+)?|CLOSE)\]/g, ' ').replace(/\s+/g, ' ').trim();
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
  const clean = text.replace(/\[(?:ITEM(?::\d+)?|CLOSE)\]/g, ' ').replace(/\s+/g, ' ').trim();
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
