'use strict';
// Focused harness: reproduces the timeline-computation block of build_background.js
// main() against the collapse-case fixture, WITHOUT running Remotion or downloading
// images. Exercises the REAL exported functions (buildCaptionsFromKokoroWithText,
// computeSegmentStartSecs, computeTimeline, assertTimelineSync) so the printed SYNC
// REPORT is the genuine one. totalDuration comes from the captions' last token
// (no speech.mp3 needed). Usage: node .test/run_collapse_case.js
const fs = require('fs');
const path = require('path');
const bb = require('../build_background.js');

const FIX = path.join(__dirname, 'collapse-case');

const speechText = fs.readFileSync(path.join(FIX, 'speech.txt'), 'utf8');
const kokoro = JSON.parse(fs.readFileSync(path.join(FIX, 'captions.json'), 'utf8'));
const prod = bb.loadProduction();
const FPSp = prod.canvas.fps;

// totalDuration: last token end_time (the audio's true length for this fixture).
const totalDuration = kokoro[kokoro.length - 1].end_time;

// --- Replicate main()'s segment parsing (lines ~218-285) -------------------
const ITEM_RE = /\[ITEM(?::(\d+))?\]/g;
const hasClose = /\[CLOSE\]/.test(speechText);
const allSegments = speechText.split(/\[ITEM(?::\d+)?\]|\[CLOSE\]/).map(s => s.trim()).filter(Boolean);
const closingSegment = hasClose ? allSegments[allSegments.length - 1] : null;
const middleSegments = hasClose ? allSegments.slice(0, -1) : allSegments;
const hasIntro = !speechText.trimStart().startsWith('[ITEM');
const storySegments = hasIntro ? middleSegments.slice(1) : middleSegments;

// Self-contained 10-story news manifest matching the fixture's [ITEM:1..10] +
// section layout (items 1-5 top, 6-8 sports, 9-10 entertainment). No root
// news.json needed -- this makes the fixture runnable from a fresh checkout.
const SECTIONS = ['top', 'top', 'top', 'top', 'top', 'sports', 'sports', 'sports', 'entertainment', 'entertainment'];
const newsItems = SECTIONS.map((section, i) => ({ title: `Story ${i + 1}`, image: null, section }));
const count = Math.min(storySegments.length, newsItems.length);

const captions = bb.buildCaptionsFromKokoroWithText(kokoro, speechText);

const activeSegments = [
  ...(hasIntro ? [middleSegments[0]] : []),
  ...storySegments.slice(0, count),
  ...(hasClose ? [closingSegment] : []),
];
const segStartSecs = bb.computeSegmentStartSecs(captions, activeSegments, totalDuration);
const segmentDurations = bb.contiguousFramesFromStarts(segStartSecs, totalDuration);
const closingFrames = hasClose ? segmentDurations[segmentDurations.length - 1] : null;

// storyCount: number of story scenes (excludes intro placeholder + closing).
const storyCount = count;
const storyBase = hasIntro ? 1 : 0;
const introNarrFrames = hasIntro
  ? Math.max(0, Math.round((segStartSecs[storyBase] ?? 0) * FPSp))
  : 0;
const closeStartSec = hasClose ? segStartSecs[segStartSecs.length - 1] : null;

const timeline = bb.computeTimeline(prod, {
  hasIntro, introNarrFrames, segStartSecs, totalDuration,
  storyCount, closeStartSec, closingFrames,
});

const storyAudioSecs = [];
for (let i = 0; i < storyCount; i++) storyAudioSecs.push(segStartSecs[storyBase + i] ?? 0);
const storyWordCounts = storySegments.slice(0, count).map(seg => seg.split(/\s+/).filter(Boolean).length);

console.log(`\n[harness] origWords=${speechText.replace(/\[(?:ITEM(?::\d+)?|CLOSE)\]/g,' ').trim().split(/\s+/).filter(Boolean).length} captions=${captions.length} totalDuration=${totalDuration.toFixed(3)}s storyCount=${storyCount} hasIntro=${hasIntro} hasClose=${hasClose}`);

// Dump per-segment start secs so we can SEE the collapse independent of the report.
console.log('[harness] segStartSecs:', segStartSecs.map(s => s == null ? 'null' : s.toFixed(3)).join('  '));

let threw = null;
try {
  bb.assertTimelineSync(timeline, { storyAudioSecs, closeAudioSec: closeStartSec, storyWordCounts });
} catch (e) {
  threw = e;
}
if (threw) {
  console.error(`\n[harness] assertTimelineSync THREW: ${threw.message}`);
  process.exitCode = 1;
} else {
  console.log('\n[harness] assertTimelineSync passed (no throw).');
}
