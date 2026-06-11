'use strict';

// Data-driven final composite. Stacks layers onto the Remotion background, each
// keyed and time-offset per composite.json, and mixes the audio:
//   background_video.mp4   base — the full show
//   + avatar.mp4           magenta-keyed pytoon avatar, offset to narration start
//   + captions_overlay.mp4 green-keyed captions, offset to narration start
//   + speech.mp3           narration, delayed to narration start
//   + per-scene music      scene-timeline driven beds/stings (see below), or a
//                          single looped bed when composite.json has no `scenes`
//
// The avatar is just one keyed overlay layer — swap pytoon for any other talking
// head later by producing a different avatar.mp4; nothing else changes.
//
// ffmpeg compatibility: the self-hosted Windows runner has ffmpeg 4.x. Only
// 4.x-safe filters/options are used (atrim/adelay/afade/volume/amix WITHOUT the
// `normalize` option — amix scales inputs by 1/n, so we boost back with volume=n).

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BG = path.join(__dirname, 'background_video.mp4');
const AVATAR = path.join(__dirname, 'avatar.mp4');
const CAPTIONS = path.join(__dirname, 'captions_overlay.mp4');
const AUDIO = path.join(__dirname, 'speech.mp3');
const COMPOSITE_JSON = path.join(__dirname, 'composite.json');
const OUTPUT = path.join(__dirname, 'animation.mp4');
const AUDIO_DIR = path.join(__dirname, 'assets', 'audio');

function probeDuration(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    return parseFloat(out.trim());
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Per-scene audio engine. composite.json (build_background.js) provides:
//   scenes: [{type:'opening'|'headlines'|'story'|'closing', start, end, emotion?}]
//   storyBoundaries: [sec, ...]   cut points between consecutive story slides
//   audioSeed: int                deterministic per-run variant rotation seed
// Each scene window gets its own bed, trimmed + faded at the edges; windows
// overlap at scene/slide transitions, so adjacent fades act as a poor-man's
// crossfade. Stingers mark the story cuts; a sign-off sting caps the closing.
// ---------------------------------------------------------------------------
const OPENING_STING = 'LogoSting1.mp3';
const CLOSING_BED = 'outro_closing_bed.mp3';
const BED_VARIANTS = {
  headlines: ['headlines_rundown1.mp3', 'headlines_rundown2.mp3', 'headlines_rundown3.mp3', 'headlines_rundown4.mp3'],
  angry: ['storybed_angry_scandal_1.mp3', 'storybed_angry_scandal_2.mp3', 'storybed_angry_scandal_3.mp3'],
  sad: ['storybed_sad_tragedy_1.mp3', 'storybed_sad_tragedy_2.mp3', 'storybed_sad_tragedy_3.mp3'],
  happy: ['storybed_happy_win_1.mp3', 'storybed_happy_win_2.mp3'],
  explain: ['storybed_explain_neutral_1.mp3', 'storybed_explain_neutral_2.mp3'],
};
// pytoon emotions → bed family (rhetorical/confused/unknown ride the neutral bed)
const EMOTION_TO_BED = { angry: 'angry', sad: 'sad', happy: 'happy', explain: 'explain', rhetorical: 'explain' };
const TRANSITION_STINGS = ['transition1.mp3', 'transition2.mp3'];
const SIGNOFFS = ['SignOff1.mp3', 'SignOff2.mp3'];

const VOL = { sting: 0.9, bed: 0.16, transition: 0.5, signoff: 0.8 };
const BED_FADE = 0.7; // s — fade in/out at every bed's window edges

// Scene timeline → list of audio elements {file, delay, vol, loop?, trim?, fade?}.
// Variant rotation: variant = (audioSeed + sceneIndex) % numVariants — stable for
// a given run, different across runs, so consecutive editions don't sound stale.
function buildSceneAudioElements(cfg) {
  const seed = Math.abs(Math.round(cfg.audioSeed || 0));
  const pick = (arr, idx) => arr[(seed + idx) % arr.length];
  const els = [];

  cfg.scenes.forEach((sc, si) => {
    const len = Math.max(0.1, (sc.end || 0) - (sc.start || 0));
    if (sc.type === 'opening') {
      // Brand sting — ~2s, sized to the opening; plays out naturally at full tilt.
      els.push({ file: OPENING_STING, delay: sc.start, vol: VOL.sting });
    } else if (sc.type === 'headlines') {
      els.push({ file: pick(BED_VARIANTS.headlines, si), loop: true, trim: len, fade: BED_FADE, delay: sc.start, vol: VOL.bed });
    } else if (sc.type === 'story') {
      const bedKey = EMOTION_TO_BED[String(sc.emotion || '').toLowerCase()] || 'explain';
      els.push({ file: pick(BED_VARIANTS[bedKey], si), loop: true, trim: len, fade: BED_FADE, delay: sc.start, vol: VOL.bed });
    } else if (sc.type === 'closing') {
      els.push({ file: CLOSING_BED, loop: true, trim: len, fade: BED_FADE, delay: sc.start, vol: VOL.bed });
      // Sign-off sting (~2s) lands so it ENDS just before the video does.
      const so = pick(SIGNOFFS, si);
      const soDur = probeDuration(path.join(AUDIO_DIR, so)) || 2.0;
      els.push({ file: so, delay: Math.max(sc.start, sc.end - soDur - 0.1), vol: VOL.signoff });
    }
  });

  (cfg.storyBoundaries || []).forEach((t, bi) => {
    els.push({ file: pick(TRANSITION_STINGS, bi), delay: Math.max(0, t), vol: VOL.transition });
  });

  return els.filter((el) => {
    if (fs.existsSync(path.join(AUDIO_DIR, el.file))) return true;
    console.warn(`  audio asset missing, skipping: ${el.file}`);
    return false;
  });
}

function main() {
  if (!fs.existsSync(BG)) {
    console.log('No background_video.mp4 — nothing to composite.');
    if (fs.existsSync(AVATAR)) fs.copyFileSync(AVATAR, OUTPUT);
    return;
  }

  const cfg = fs.existsSync(COMPOSITE_JSON)
    ? JSON.parse(fs.readFileSync(COMPOSITE_JSON, 'utf8'))
    : { fps: 30, narrationStartSec: 0 };
  const fps = cfg.fps || 30;
  const S = cfg.narrationStartSec ?? cfg.storiesStartSec ?? 0;     // narration offset (s)
  const D = cfg.narrationDurationSec ?? cfg.storiesDurationSec ?? 0; // narration length (s)
  const delayMs = Math.round(S * 1000);
  const avatarKey = cfg.avatarKey || '0xFF00FF';
  const captionsKey = cfg.captionsKey || '0x00FF00';
  const gate = D > 0 ? `:enable='between(t,${S},${S + D})'` : '';

  const bgDur = probeDuration(BG);

  const hasAvatar = fs.existsSync(AVATAR);
  const hasCaptions = fs.existsSync(CAPTIONS);
  const hasAudio = fs.existsSync(AUDIO);
  const hasScenes = Array.isArray(cfg.scenes) && cfg.scenes.length > 0;
  // Legacy fallback (classic theme / old composite.json): one looped bed.
  const musicFile = cfg.music && cfg.music.file ? path.join(__dirname, cfg.music.file) : null;
  const hasMusic = musicFile && fs.existsSync(musicFile);
  const musicVol = (cfg.music && typeof cfg.music.volume === 'number') ? cfg.music.volume : 0.18;

  // ---- video layer stack ----
  const inputs = ['-i', BG];
  const filters = [];
  let vlabel = '0:v';
  let i = 1;

  if (hasAvatar) {
    // Optional per-theme avatar transform (crop to James, scale, reposition).
    // Default = full frame at 0:0 (studio-box themes). Layouts that place James as a
    // corner/bottom "presenter" pass { crop, scale, x, y } in composite.json.avatar.
    const av = cfg.avatar || {};
    const cropF = av.crop ? `crop=${av.crop},` : '';
    const scaleF = (av.scale && av.scale !== 1)
      ? `scale=trunc(iw*${av.scale}/2)*2:trunc(ih*${av.scale}/2)*2,` : '';
    const ox = av.x ?? 0, oy = av.y ?? 0;
    inputs.push('-i', AVATAR);
    filters.push(`[${i}:v]fps=${fps},${cropF}colorkey=${avatarKey}:0.30:0.10,${scaleF}setpts=PTS+${S}/TB[av]`);
    filters.push(`[${vlabel}][av]overlay=${ox}:${oy}:eof_action=pass${gate}[v${i}]`);
    vlabel = `v${i}`; i++;
  }
  if (hasCaptions) {
    inputs.push('-i', CAPTIONS);
    filters.push(`[${i}:v]fps=${fps},colorkey=${captionsKey}:0.40:0.10,setpts=PTS+${S}/TB[cap]`);
    filters.push(`[${vlabel}][cap]overlay=0:0:eof_action=pass${gate}[v${i}]`);
    vlabel = `v${i}`; i++;
  }
  // Square pixels + a real terminal label — some players (Telegram mobile) squish
  // the video when SAR is unset/odd.
  filters.push(`[${vlabel}]setsar=1[vout]`);

  // ---- audio mix: delayed narration + music (per-scene engine or legacy bed) ----
  const map = ['-map', '[vout]'];
  let narrLabel = null;
  let bedLabel = null;

  if (hasAudio) {
    inputs.push('-i', AUDIO);
    filters.push(`[${i}:a]adelay=${delayMs}|${delayMs},volume=1.0[narr]`);
    narrLabel = '[narr]'; i++;
  }

  const musicEls = hasScenes ? buildSceneAudioElements(cfg) : [];
  if (musicEls.length) {
    const labels = [];
    musicEls.forEach((el, n) => {
      if (el.loop) inputs.push('-stream_loop', '-1'); // beds may be shorter than their scene
      inputs.push('-i', path.join(AUDIO_DIR, el.file));
      const chain = ['aresample=44100']; // uniform rate so the submix is deterministic
      if (el.trim) chain.push(`atrim=0:${el.trim.toFixed(3)}`);
      if (el.fade && el.trim) {
        chain.push(`afade=t=in:st=0:d=${el.fade}`);
        chain.push(`afade=t=out:st=${Math.max(0, el.trim - el.fade).toFixed(3)}:d=${el.fade}`);
      }
      const ms = Math.round((el.delay || 0) * 1000);
      chain.push(`volume=${el.vol}`, `adelay=${ms}|${ms}`);
      filters.push(`[${i}:a]${chain.join(',')}[m${n}]`);
      labels.push(`[m${n}]`); i++;
    });
    if (labels.length === 1) {
      filters.push(`${labels[0]}anull[bed]`);
    } else {
      // amix scales every input by 1/n (no `normalize` on ffmpeg 4.x) → volume=n
      // restores the straight sum. dropout_transition=600 keeps levels constant
      // as elements end at different times.
      filters.push(`${labels.join('')}amix=inputs=${labels.length}:duration=longest:dropout_transition=600,volume=${labels.length}[bed]`);
    }
    bedLabel = '[bed]';
    console.log(`Per-scene audio: ${musicEls.length} elements (seed ${cfg.audioSeed || 0}) — ` +
      musicEls.map((e) => `${e.file}@${(e.delay || 0).toFixed(1)}s`).join(', '));
  } else if (hasMusic) {
    inputs.push('-stream_loop', '-1', '-i', musicFile);
    filters.push(`[${i}:a]volume=${musicVol}[bed]`);
    bedLabel = '[bed]'; i++;
  }

  if (narrLabel && bedLabel) {
    // NOTE: amix's `normalize` option needs ffmpeg>=5 (the Windows runner has 4.x).
    // Portable equivalent: amix halves both inputs (1/n), so boost back with volume=2.
    // High dropout_transition keeps the bed from ramping up after the narration ends.
    filters.push(`${narrLabel}${bedLabel}amix=inputs=2:duration=longest:dropout_transition=600,volume=2[aud]`);
    map.push('-map', '[aud]');
  } else if (narrLabel || bedLabel) {
    filters.push(`${narrLabel || bedLabel}anull[aud]`);
    map.push('-map', '[aud]');
  }

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    ...map,
    ...(bgDur ? ['-t', String(bgDur)] : []),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    OUTPUT,
  ];

  console.log(`Compositing final video (narration offset ${S.toFixed(2)}s, ${musicEls.length ? `${musicEls.length} scene-audio elements` : hasMusic ? `music bed @ ${musicVol}` : 'no music'})...`);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`Final video written: ${OUTPUT}`);
}

main();
