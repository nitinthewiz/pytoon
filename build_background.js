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
// Overlay-wipe length at STORY->STORY cuts (frames). The branded StingerWipe is
// drawn ON TOP of a hard cut, centred on the boundary -- it consumes NO timeline
// frames (that was the old TransitionSeries.Transition bug). Visuals unchanged
// (~15f @30fps), see remotion/src/themes/newshound/StingerWipe.tsx.
const WIPE_FRAMES = 15;
// Build-time sync tolerance (frames). Rounding to whole frames at scene/word
// boundaries can disagree by ~1f between the JS and TS sides; +-2 absorbs that
// without ever masking a real drift (the old bug was 4+ frames and grew).
const SYNC_TOL_FRAMES = 2;

function loadProduction() {
  return JSON.parse(fs.readFileSync(PRODUCTION_JSON, 'utf8'));
}

// --- Absolute-frame timeline (THE single source of truth) -------------------
//
// One timeline, anchored to the Kokoro caption word-timestamps. Every scene is
// a plain, contiguous, NON-overlapping window [startFrame, endFrame) on the
// final video timeline; the same frames drive BOTH the Remotion composition
// (passed in render-props.timeline) and composite.json.scenes (compose.js's
// per-scene audio). No transition-frame bookkeeping, no second word-splitter --
// transitions are painted as OVERLAYS on top of the hard cuts.
//
//   narrationStartSec : where the audio/avatar/captions begin (UNCHANGED -- same
//                       HOOK_OVERLAP behaviour as before).
//   opening  [0, openingFrames)                    -- cold-open splash (scene cut)
//   headlines[openingFrames, story1Start)          -- THE RUNDOWN, under the intro narration
//   story k  [narrStart + capStart(k), next)       -- anchored to its first spoken word
//   closing  [narrStart + capStart(close), showEnd)-- absorbs all residual slack
//
// segStartSecs are the per-segment first-word start times pulled from the SAME
// captions array the on-screen captions use (reused from computeSegmentDurations
// -- that lookup is correct; the old drift lived only in the transition math).
function computeTimeline(prod, opts) {
  const pfps = prod.canvas.fps;
  const theme = prod.theme || 'classic';
  const isNH = theme.startsWith('newshound');
  const dur = (t) => (prod.scenes.find((s) => s.type === t) || {}).durationSec || 0;
  const openingFrames = Math.round(dur('opening') * pfps);
  const hookF = isNH ? Math.round((prod.hookOverlapSec || 0) * pfps) : 0;
  // Closing scene minimum length (frames): the [CLOSE] narration drives it when
  // present, else the configured closing default. The Closing scene is then
  // stretched so it can never under-run the audio (see showEndFrames below).
  const closingTailFrames = opts.closingFrames
    ?? Math.round(dur('closing') * pfps);
  // Small fixed HOLD after the last spoken word so the sign-off card lingers a
  // beat instead of hard-cutting to black (~0.6s). The closing never ends
  // before narration end + this hold -> the video can't under-run the audio.
  const SHOW_TAIL_FRAMES = Math.round(0.6 * pfps);

  const {
    hasIntro, introNarrFrames, segStartSecs, totalDuration,
    storyCount, closeStartSec,
  } = opts;

  // narrationStart: newshound starts the audio so story-1's narration lands on
  // the Stories-scene start, entering the opening splash by the hook overlap;
  // classic just starts at the Stories scene. introNarrFrames is the intro's
  // EXACT caption length (story-1 first-word sec * fps) -- no TRANSITION_FRAMES
  // fudge anymore, because nothing overlaps.
  const storiesSceneStartF = openingFrames + Math.max(0, isNH ? introNarrFrames - hookF : introNarrFrames);
  const narrStartF = isNH
    ? Math.max(0, storiesSceneStartF - introNarrFrames)
    : storiesSceneStartF;
  const narrationStartSec = narrStartF / pfps;

  // Absolute start frame of each segment = narrationStart + its first-word sec.
  // segStartSecs covers [intro?, story1..N, close?]; index past the intro.
  const storyBase = hasIntro ? 1 : 0;
  const absFrame = (sec) => Math.round((narrationStartSec + sec) * pfps);
  const storyStartFrames = [];
  for (let i = 0; i < storyCount; i++) {
    storyStartFrames.push(absFrame(segStartSecs[storyBase + i] ?? 0));
  }
  const closingStartF = closeStartSec != null ? absFrame(closeStartSec) : null;

  // Show end: the Closing absorbs all residual slack. Its end is the later of
  // (its own start + its narration length) and (narration end), plus a small
  // fixed hold -- so the sign-off card is always on screen for its full line and
  // the video can NEVER under-run the audio. With no [CLOSE] segment, the last
  // story simply runs to that same end.
  const narrEndF = Math.round((narrationStartSec + totalDuration) * pfps);
  const lastSceneStartF = closingStartF != null
    ? closingStartF
    : (storyStartFrames[storyCount - 1] ?? storiesSceneStartF);
  const showEndFrames = Math.max(lastSceneStartF + closingTailFrames, narrEndF) + SHOW_TAIL_FRAMES;

  return {
    fps: pfps, isNH, narrationStartSec,
    openingFrames,
    headlinesStartF: openingFrames,           // hard cut right after the opening
    storiesSceneStartF,
    storyStartFrames,                         // absolute start of each story scene
    closingStartF,                            // null when no [CLOSE] segment
    showEndFrames,
    introNarrFrames, hookF, closingTailFrames, narrEndF,
  };
}

// Build-time SYNC ASSERTION. Proves the ONE timeline is contiguous and that
// every scene lands on its audio anchor, then prints a report so each render
// proves sync in the log instead of us eyeballing it. Throws (fails the build)
// on any break beyond +-SYNC_TOL_FRAMES -- we never ship drift again.
function assertTimelineSync(tl, ctx) {
  const FPSr = tl.fps;
  const errs = [];
  // Ordered scene list with the audio start each scene is SUPPOSED to hit.
  const rows = [];
  const push = (type, startF, audioSec) => rows.push({ type, startF, audioSec });
  push('opening', 0, null);
  push('headlines', tl.headlinesStartF, null);
  tl.storyStartFrames.forEach((f, i) => push(`story_${i + 1}`, f, ctx.storyAudioSecs[i]));
  if (tl.closingStartF != null) push('closing', tl.closingStartF, ctx.closeAudioSec);
  // Synthetic end row so the contiguity check covers the final scene too.
  const endRow = { type: '(end)', startF: tl.showEndFrames, audioSec: null };

  // 1) contiguous + non-overlapping: every scene starts where the previous ended.
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].startF < rows[i - 1].startF) {
      errs.push(`scene "${rows[i].type}" starts (${rows[i].startF}f) before previous "${rows[i - 1].type}" (${rows[i - 1].startF}f)`);
    }
  }
  if (endRow.startF < rows[rows.length - 1].startF) {
    errs.push(`show end (${endRow.startF}f) before last scene "${rows[rows.length - 1].type}" (${rows[rows.length - 1].startF}f)`);
  }

  // 2) each story/closing scene start == narrationStart + (first-word sec)*fps.
  const within = (a, b) => Math.abs(a - b) <= SYNC_TOL_FRAMES;
  rows.forEach((r) => {
    if (r.audioSec == null) return;
    const expect = Math.round((tl.narrationStartSec + r.audioSec) * FPSr);
    if (!within(r.startF, expect)) {
      errs.push(`scene "${r.type}" start ${r.startF}f != audio-anchored ${expect}f (delta ${r.startF - expect}f)`);
    }
  });

  // 3) Stories block first frame == narrationStart + intro-narration frames
  //    == story-1 audio start.
  const story1F = tl.storyStartFrames[0];
  if (story1F != null) {
    const introImplied = Math.round(tl.narrationStartSec * FPSr) + tl.introNarrFrames;
    if (!within(story1F, introImplied)) {
      errs.push(`story_1 start ${story1F}f != narrationStart+introNarration ${introImplied}f (delta ${story1F - introImplied}f)`);
    }
    if (!within(tl.storiesSceneStartF, story1F)) {
      errs.push(`storiesSceneStart ${tl.storiesSceneStartF}f != story_1 start ${story1F}f (delta ${tl.storiesSceneStartF - story1F}f)`);
    }
  }

  // 4) total duration == Closing end AND >= narrationStart + total narration.
  if (tl.showEndFrames < tl.narrEndF) {
    errs.push(`show end ${tl.showEndFrames}f < narration end ${tl.narrEndF}f -- video would under-run audio`);
  }

  // --- SYNC REPORT --------------------------------------------------------
  const f2s = (f) => (f / FPSr).toFixed(3);
  const allRows = [...rows, endRow];
  const lines = allRows.map((r, i) => {
    const next = allRows[i + 1];
    const lenF = next ? next.startF - r.startF : 0;
    const audioStr = r.audioSec == null ? '-' : (tl.narrationStartSec + r.audioSec).toFixed(3);
    const expectF = r.audioSec == null ? null : Math.round((tl.narrationStartSec + r.audioSec) * FPSr);
    const deltaF = expectF == null ? '-' : String(r.startF - expectF);
    return [
      r.type.padEnd(10),
      String(r.startF).padStart(6),
      (f2s(r.startF) + 's').padStart(9),
      (next ? String(lenF).padStart(5) + 'f' : '    -'),
      audioStr.padStart(8),
      deltaF.padStart(7),
    ].join('  ');
  });
  console.log('\n------------ SYNC REPORT (absolute-frame timeline) ------------');
  console.log(['scene'.padEnd(10), 'start'.padStart(6), 'startSec'.padStart(9), ' len'.padStart(6), 'audioSt'.padStart(8), 'dVframe'.padStart(7)].join('  '));
  lines.forEach((l) => console.log(l));
  console.log(`narrationStart=${tl.narrationStartSec.toFixed(3)}s  narrationEnd=${f2s(tl.narrEndF)}s  showEnd=${f2s(tl.showEndFrames)}s  tol=+-${SYNC_TOL_FRAMES}f`);
  console.log('---------------------------------------------------------------\n');

  if (errs.length) {
    console.error('SYNC ASSERTION FAILED:');
    errs.forEach((e) => console.error('  x ' + e));
    throw new Error(`Audio/visual timeline out of sync (${errs.length} issue(s)) -- refusing to render. See SYNC REPORT above.`);
  }
  console.log('SYNC OK -- scenes contiguous and anchored to the narration (+-' + SYNC_TOL_FRAMES + 'f).');
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

  // N stories, generically: 5 today, up to 10 with the 5+3+2 section format
  // (news[] items then carry section:'top'|'sports'|'entertainment'). Every
  // story gets a scene + an emotion bed; sections are purely visual overlays
  // in the theme (divider card + badge) and never touch the timeline.
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
  // Per-segment first-word start seconds (the single timing source) + the
  // contiguous per-segment frame lengths for items[].durationInFrames.
  const segStartSecs = computeSegmentStartSecs(captions, activeSegments, totalDuration);
  const segmentDurations = contiguousFramesFromStarts(segStartSecs, totalDuration);
  // Closing scene tail = the [CLOSE] segment's caption length (its own narration
  // drives it). The absolute timeline then stretches the Closing to swallow any
  // residual slack so the video never under-runs the audio.
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

    // Show section (5+3+2 format): normalized lowercase, omitted when absent so
    // classic 5-story manifests keep byte-identical render props.
    const section = typeof newsItem.section === 'string' && newsItem.section.trim()
      ? newsItem.section.trim().toLowerCase()
      : undefined;
    const storyMeta = {
      title: newsItem.title || '',
      source: newsItem.source || '',
      // category badge, chyron take and rundown teaser come from the LLM when present.
      category: (tags && tags[i]) || newsItem.category || 'Top News',
      take: (takes && takes[i]) || undefined,
      teaser: (teasers && teasers[i]) || undefined,
      ...(section ? { section } : {}),
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

  // --- ONE absolute-frame timeline, anchored to the captions ----------------
  // Built BEFORE rendering so the exact same scene frames go into BOTH the
  // Remotion comp (render-props.timeline) and composite.json.scenes. The intro
  // narration length (story-1's first-word sec) sets where Stories begins.
  const storyItemsAll = items.filter((it) => !(it.imagePath === null && it.teaserImages != null));
  const storyCount = storyItemsAll.length;
  const storyBase = hasIntro ? 1 : 0;
  // intro narration frames = exact caption length of the intro segment (= story-1
  // first-word sec). 0 when there is no intro (classic [ITEM]-first scripts).
  const introNarrFrames = hasIntro
    ? Math.max(0, Math.round((segStartSecs[storyBase] ?? 0) * (prod.canvas.fps)))
    : 0;
  const closeStartSec = hasClose ? segStartSecs[segStartSecs.length - 1] : null;

  const timeline = computeTimeline(prod, {
    hasIntro, introNarrFrames, segStartSecs, totalDuration,
    storyCount, closeStartSec, closingFrames,
  });

  // Build-time sync guard: the audio start each scene must hit (for the report).
  const storyAudioSecs = [];
  for (let i = 0; i < storyCount; i++) storyAudioSecs.push(segStartSecs[storyBase + i] ?? 0);
  if (isNH) {
    assertTimelineSync(timeline, { storyAudioSecs, closeAudioSec: closeStartSec });
  }

  // Scene frames the Remotion comp consumes (newshound themes lay plain,
  // contiguous Sequences at these absolute frames; transitions are overlays).
  const sceneTimeline = isNH ? {
    openingFrames: timeline.openingFrames,
    headlinesStartFrame: timeline.headlinesStartF,
    storyStartFrames: timeline.storyStartFrames,
    closingStartFrame: timeline.closingStartF, // null when no [CLOSE]
    showEndFrame: timeline.showEndFrames,
    wipeFrames: WIPE_FRAMES,
  } : undefined;

  fs.writeFileSync(PROPS_FILE, JSON.stringify(
    { items, captions, captionTop, closingFrames, ...(sceneTimeline ? { timeline: sceneTimeline } : {}) },
    null, 2));

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
  const composite = {
    fps: timeline.fps,
    narrationStartSec: timeline.narrationStartSec,
    narrationDurationSec: totalDuration,
    avatarKey: '0xFF00FF',
    captionsKey: '0x00FF00',
  };

  // fb layout: James is a CENTERED bottom "presenter" — crop to James, scale
  // down, place over the image's bottom (compose.js applies the transform).
  if (theme === 'newshound-fb') {
    // y nudged down (1078->1088); still ~40px above captionTop (1580).
    composite.avatar = { crop: '760:704:160:0', scale: 0.64, x: 297, y: 1088 };
  }

  if (isNH) {
    // --- Scene windows for compose.js's per-scene audio engine --------------
    // Times in SECONDS on the FINAL video timeline, derived from the SAME
    // absolute scene frames as the Remotion comp — so beds line up with scenes
    // exactly. Windows are now CONTIGUOUS (each start == previous end); the
    // per-bed BED_FADE at the hard cut gives the crossfade dip.
    const f2s = (f) => Number((Math.max(0, f) / timeline.fps).toFixed(3));
    const emotions = loadJson(path.join(__dirname, 'emotions.json')) || [];
    const starts = timeline.storyStartFrames;
    const closeF = timeline.closingStartF;
    // First frame after the last story scene (= closing start, else show end).
    const afterStoriesF = closeF != null ? closeF : timeline.showEndFrames;

    const scenes = [
      { type: 'opening', start: 0, end: f2s(timeline.headlinesStartF) },
      { type: 'headlines', start: f2s(timeline.headlinesStartF), end: f2s(starts[0] ?? afterStoriesF) },
    ];
    const storyBoundaries = []; // cut frames between consecutive story slides
    starts.forEach((sf, i) => {
      const endF = i + 1 < starts.length ? starts[i + 1] : afterStoriesF;
      scenes.push({ type: 'story', start: f2s(sf), end: f2s(endF), emotion: emotions[i] || 'explain' });
      if (i > 0) storyBoundaries.push(f2s(sf)); // boundary == this story's start
    });
    if (closeF != null) {
      scenes.push({ type: 'closing', start: f2s(closeF), end: f2s(timeline.showEndFrames) });
    }

    composite.scenes = scenes;
    composite.storyBoundaries = storyBoundaries;
    composite.audioSeed = computeAudioSeed(speechText);
  } else {
    // classic theme — single looped music bed (compose.js fallback path)
    composite.music = { file: 'assets/News Background Test.m4a', volume: 0.18 };
  }

  fs.writeFileSync(COMPOSITE_JSON, JSON.stringify(composite, null, 2));
  console.log(`${bgComp} + captions created. Narration ${composite.narrationStartSec.toFixed(2)}s-${(composite.narrationStartSec + composite.narrationDurationSec).toFixed(2)}s, showEnd ${(timeline.showEndFrames / timeline.fps).toFixed(2)}s.`);
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

// Per-segment FIRST-WORD start seconds, from the per-original-word captions array
// (built by buildCaptionsFromKokoroWithText, so it already handles number-expansion
// drift). Each segment's first word maps 1:1 to a caption entry -> an exact start
// time, the same mapping the on-screen captions use. This is the load-bearing,
// correct piece; the absolute-frame timeline (computeTimeline) anchors every scene
// to these. Falls back to word-count proportions when captions are empty.
//
// Returns one start-second per segment, monotonic and never null. segments are
// [intro?, story1..N, close?]; segStartSecs[0] is ~0.
function computeSegmentStartSecs(captions, segments, totalDuration) {
  const wordCounts = segments.map(seg => seg.split(/\s+/).filter(Boolean).length);

  if (!captions || captions.length === 0) {
    // No timing: spread starts across the audio by cumulative word fraction.
    const totalWords = wordCounts.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    return segments.map((_, i) => {
      const startSec = (acc / totalWords) * totalDuration;
      acc += wordCounts[i];
      return startSec;
    });
  }

  // captions[i] corresponds to the i-th original (cleaned-text) word, in order.
  let wordIdx = 0;
  const segStartSecs = segments.map((seg, i) => {
    // null = mapping ran out of captions (captions array shorter than the
    // script -- should not happen now that buildCaptionsFromKokoroWithText
    // always emits one caption per word, but never trust it blindly).
    const startSec = wordIdx < captions.length ? captions[wordIdx].startMs / 1000 : null;
    wordIdx += wordCounts[i];
    return startSec;
  });

  // Safety net: spread any unmapped tail segments across the remaining audio
  // by word count, and force starts monotonic -- a degenerate caption mapping
  // must never collapse the show into minimum-length slides + a frozen closing
  // (the 2026-06-11 us-AM on-air failure).
  const firstBad = segStartSecs.indexOf(null);
  if (firstBad > 0) {
    const base = segStartSecs[firstBad - 1];
    const tailWords = wordCounts.slice(firstBad - 1).reduce((a, b) => a + b, 0) || 1;
    let acc = base;
    for (let i = firstBad; i < segStartSecs.length; i++) {
      acc += (wordCounts[i - 1] / tailWords) * Math.max(0, totalDuration - base);
      segStartSecs[i] = acc;
    }
  } else if (firstBad === 0) {
    segStartSecs[0] = 0;
  }
  for (let i = 1; i < segStartSecs.length; i++) {
    segStartSecs[i] = Math.max(segStartSecs[i], segStartSecs[i - 1]);
  }
  return segStartSecs;
}

// Contiguous per-segment frame lengths (NO transition bonus -- nothing overlaps
// anymore). Each segment runs from its caption start to the next segment's start;
// the final segment runs to totalDuration. Used for items[].durationInFrames,
// which only drives a scene's INTERNAL animation timing (Ken Burns, progress
// pips) -- the scene's on-screen window is set by the absolute timeline, not this.
function contiguousFramesFromStarts(segStartSecs, totalDuration) {
  return segStartSecs.map((startSec, i) => {
    const endSec = i + 1 < segStartSecs.length ? segStartSecs[i + 1] : totalDuration;
    return Math.max(FPS, Math.round((endSec - startSec) * FPS));
  });
}

// Build captions using original speech text for display (preserving numbers like "2026"
// and punctuation like commas) but Kokoro token timestamps for timing.
//
// Kokoro expands one written word into several spoken tokens ("2026" → "twenty
// twenty-six"), and voices NO token at all for pure-punctuation words (the spunky
// scripts' standalone "-" aside markers), so tokens don't map 1-to-1 with original
// words. Per word: when the IMMEDIATE next word has recognisable alpha content, scan
// a BOUNDED window ahead for its first token and let this word span everything before
// it (this both covers expansions and re-syncs any drift). The bound is the critical
// safety property: the 2026-06-11 us-AM edition drifted one token (a "-" aside),
// then the unbounded hunt for "times" after "18" swallowed every remaining token —
// captions froze on "18" and every later scene collapsed (the on-air "scenes blast
// by, last screen frozen" failure). If the anchor isn't found within the window,
// consume exactly one token and let the next word re-sync — NEVER eat the tail.
function buildCaptionsFromKokoroWithText(timestamps, speechText) {
  const clean = speechText.replace(/\[(?:ITEM(?::\d+)?|CLOSE)\]/g, ' ').replace(/\s+/g, ' ').trim();
  const origWords = clean.split(' ').filter(Boolean);
  if (origWords.length === 0) return [];

  // Only word tokens (no punctuation) — used purely for timing
  const wordToks = timestamps.filter(t => /\w/.test(t.word));
  if (wordToks.length === 0) return [];

  const alphaOf = (s) => s.replace(/[^a-zA-Z]/g, '').toLowerCase();
  // Max tokens one word may span while hunting for the next word's first token.
  // A long number ("$1,234,567,890.25") expands to ~10 tokens; anything past
  // this window means the anchor is simply not ahead of us.
  const RESYNC_WINDOW = 15;

  const result = [];
  const push = (wi, startMs, endMs) => result.push({
    text: wi === 0 ? origWords[wi] : ` ${origWords[wi]}`,
    startMs,
    endMs,
    timestampMs: (startMs + endMs) / 2,
    confidence: 1,
  });
  let ti = 0;
  let lastEndMs = 0;

  for (let wi = 0; wi < origWords.length; wi++) {
    // Words the TTS never voices ("-", "—", "..."): consume NO token — a
    // zero-width slot keeps the 1-original-word == 1-caption invariant without
    // shifting the timing of the words that follow. (\p{L}\p{N}: any-script
    // letters count as voiced — Hindi productions must not hit this branch.)
    if (!/[\p{L}\p{N}]/u.test(origWords[wi])) {
      push(wi, lastEndMs, lastEndMs);
      continue;
    }

    // Timestamps ended before the script did (bad TTS output) — spread the
    // leftover words across the remaining audio instead of dropping them, so
    // every original word still gets a caption and downstream slide timing
    // (computeSegmentDurations) can never collapse.
    if (ti >= wordToks.length) {
      const audioEndMs = wordToks[wordToks.length - 1].end_time * 1000;
      const step = Math.max(0, audioEndMs - lastEndMs) / (origWords.length - wi);
      for (let j = wi; j < origWords.length; j++) {
        const s = lastEndMs + (j - wi) * step;
        push(j, s, s + step);
      }
      break;
    }

    const startMs = wordToks[ti].start_time * 1000;
    let endMs = wordToks[ti].end_time * 1000;
    let consume = 1;

    // Anchor = the IMMEDIATE next word only. Scanning past a digit/punctuation
    // neighbour for a farther anchor would let "7," swallow "2026"'s expansion.
    const nextBase = wi + 1 < origWords.length ? alphaOf(origWords[wi + 1]) : '';
    if (nextBase.length >= 2) {
      const prefix = nextBase.slice(0, Math.min(nextBase.length, 4));
      for (let k = ti + 1; k < wordToks.length && k - ti <= RESYNC_WINDOW; k++) {
        const tok = alphaOf(wordToks[k].word);
        if (tok === nextBase || (tok && tok.startsWith(prefix))) {
          endMs = wordToks[k - 1].end_time * 1000;
          consume = k - ti;
          break;
        }
      }
    }

    ti += consume;
    push(wi, startMs, endMs);
    lastEndMs = endMs;
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

// Expose the pure timeline helpers for unit-checks (the sync assertion is the
// regression guard); only run the pipeline when invoked directly.
module.exports = {
  computeTimeline, assertTimelineSync, computeSegmentStartSecs,
  contiguousFramesFromStarts, buildCaptionsFromKokoroWithText, loadProduction,
  FPS, WIPE_FRAMES, SYNC_TOL_FRAMES,
};

if (require.main === module) {
  main().catch(err => {
    console.error('build_background.js failed:', err.message);
    process.exit(1);
  });
}
