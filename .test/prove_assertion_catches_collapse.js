'use strict';
// PROOF for FIX B: feed the OLD (buggy, collapsed) word->token mapping's segment
// starts through the CURRENT assertTimelineSync and show it now THROWS. The old
// assertion printed "SYNC OK" on this exact data (it was circular); the new
// independent collapse checks (5a-5d) must fail it.
//
// We reconstruct the OLD buildCaptionsFromKokoroWithText (window 15, prefix match,
// no proportional guard) inline -- that is the code that produced the collapse --
// then run the REAL computeSegmentStartSecs / computeTimeline / assertTimelineSync
// (current build_background.js) on its output.
const fs = require('fs');
const path = require('path');
const bb = require('../build_background.js');

const FIX = path.join(__dirname, 'collapse-case');
const speechText = fs.readFileSync(path.join(FIX, 'speech.txt'), 'utf8');
const kokoro = JSON.parse(fs.readFileSync(path.join(FIX, 'captions.json'), 'utf8'));
const prod = bb.loadProduction();
const FPSp = prod.canvas.fps;
const totalDuration = kokoro[kokoro.length - 1].end_time;

// ---- OLD, BUGGY mapping (verbatim from the pre-fix build_background.js) --------
function oldBuildCaptions(timestamps, speech) {
  const clean = speech.replace(/\[(?:ITEM(?::\d+)?|CLOSE)\]/g, ' ').replace(/\s+/g, ' ').trim();
  const origWords = clean.split(' ').filter(Boolean);
  if (origWords.length === 0) return [];
  const wordToks = timestamps.filter(t => /\w/.test(t.word));
  if (wordToks.length === 0) return [];
  const alphaOf = (s) => s.replace(/[^a-zA-Z]/g, '').toLowerCase();
  const RESYNC_WINDOW = 15;
  const result = [];
  const push = (wi, startMs, endMs) => result.push({
    text: wi === 0 ? origWords[wi] : ` ${origWords[wi]}`, startMs, endMs,
    timestampMs: (startMs + endMs) / 2, confidence: 1,
  });
  let ti = 0, lastEndMs = 0;
  for (let wi = 0; wi < origWords.length; wi++) {
    if (!/[\p{L}\p{N}]/u.test(origWords[wi])) { push(wi, lastEndMs, lastEndMs); continue; }
    if (ti >= wordToks.length) {
      const audioEndMs = wordToks[wordToks.length - 1].end_time * 1000;
      const step = Math.max(0, audioEndMs - lastEndMs) / (origWords.length - wi);
      for (let j = wi; j < origWords.length; j++) { const s = lastEndMs + (j - wi) * step; push(j, s, s + step); }
      break;
    }
    const startMs = wordToks[ti].start_time * 1000;
    let endMs = wordToks[ti].end_time * 1000, consume = 1;
    const nextBase = wi + 1 < origWords.length ? alphaOf(origWords[wi + 1]) : '';
    if (nextBase.length >= 2) {
      const prefix = nextBase.slice(0, Math.min(nextBase.length, 4));
      for (let k = ti + 1; k < wordToks.length && k - ti <= RESYNC_WINDOW; k++) {
        const tok = alphaOf(wordToks[k].word);
        if (tok === nextBase || (tok && tok.startsWith(prefix))) { endMs = wordToks[k - 1].end_time * 1000; consume = k - ti; break; }
      }
    }
    ti += consume; push(wi, startMs, endMs); lastEndMs = endMs;
  }
  return result;
}

// ---- segment parsing (same as main) -------------------------------------------
const hasClose = /\[CLOSE\]/.test(speechText);
const allSegments = speechText.split(/\[ITEM(?::\d+)?\]|\[CLOSE\]/).map(s => s.trim()).filter(Boolean);
const closingSegment = hasClose ? allSegments[allSegments.length - 1] : null;
const middleSegments = hasClose ? allSegments.slice(0, -1) : allSegments;
const hasIntro = !speechText.trimStart().startsWith('[ITEM');
const storySegments = hasIntro ? middleSegments.slice(1) : middleSegments;
const SECTIONS = ['top', 'top', 'top', 'top', 'top', 'sports', 'sports', 'sports', 'entertainment', 'entertainment'];
const newsItems = SECTIONS.map((section, i) => ({ title: `Story ${i + 1}`, image: null, section }));
const count = Math.min(storySegments.length, newsItems.length);

const captionsOLD = oldBuildCaptions(kokoro, speechText);

const activeSegments = [
  ...(hasIntro ? [middleSegments[0]] : []),
  ...storySegments.slice(0, count),
  ...(hasClose ? [closingSegment] : []),
];
const segStartSecs = bb.computeSegmentStartSecs(captionsOLD, activeSegments, totalDuration);
const segmentDurations = bb.contiguousFramesFromStarts(segStartSecs, totalDuration);
const closingFrames = hasClose ? segmentDurations[segmentDurations.length - 1] : null;
const storyCount = count;
const storyBase = hasIntro ? 1 : 0;
const introNarrFrames = hasIntro ? Math.max(0, Math.round((segStartSecs[storyBase] ?? 0) * FPSp)) : 0;
const closeStartSec = hasClose ? segStartSecs[segStartSecs.length - 1] : null;

const timeline = bb.computeTimeline(prod, {
  hasIntro, introNarrFrames, segStartSecs, totalDuration, storyCount, closeStartSec, closingFrames,
});
const storyAudioSecs = [];
for (let i = 0; i < storyCount; i++) storyAudioSecs.push(segStartSecs[storyBase + i] ?? 0);
const storyWordCounts = storySegments.slice(0, count).map(seg => seg.split(/\s+/).filter(Boolean).length);

console.log('[proof] OLD mapping segStartSecs:', segStartSecs.map(s => s == null ? 'null' : s.toFixed(2)).join(' '));
console.log('[proof] Running the CURRENT assertTimelineSync on the OLD collapsed timeline...\n');

let threw = null;
try {
  bb.assertTimelineSync(timeline, { storyAudioSecs, closeAudioSec: closeStartSec, storyWordCounts });
} catch (e) { threw = e; }

if (threw) {
  console.log('\n[proof] RESULT: assertTimelineSync THREW on the collapsed data -- the build would FAIL.');
  console.log('[proof] (The OLD assertion printed "SYNC OK" on this same data.)');
  process.exitCode = 0; // expected outcome
} else {
  console.error('\n[proof] RESULT: assertTimelineSync did NOT throw -- FIX B is INSUFFICIENT.');
  process.exitCode = 2;
}
