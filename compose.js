'use strict';

// Data-driven final composite. Stacks layers onto the Remotion background, each
// keyed and time-offset per composite.json, and mixes the audio:
//   background_video.mp4   base — the full show
//   + avatar.mp4           magenta-keyed pytoon avatar, offset to narration start
//   + captions_overlay.mp4 green-keyed captions, offset to narration start
//   + speech.mp3           narration, delayed to narration start
//   + music bed            looped under everything at low volume
//
// The avatar is just one keyed overlay layer — swap pytoon for any other talking
// head later by producing a different avatar.mp4; nothing else changes.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BG = path.join(__dirname, 'background_video.mp4');
const AVATAR = path.join(__dirname, 'avatar.mp4');
const CAPTIONS = path.join(__dirname, 'captions_overlay.mp4');
const AUDIO = path.join(__dirname, 'speech.mp3');
const COMPOSITE_JSON = path.join(__dirname, 'composite.json');
const OUTPUT = path.join(__dirname, 'animation.mp4');

function probeDuration(file) {
  try {
    const out = execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
    return parseFloat(out.trim());
  } catch { return null; }
}

// PLACEHOLDER audio test: pitch-shift the narration per segment (keeping duration)
// so each story sounds distinct. Returns the pitched file path, or the original on
// failure. Normalizes to 44.1k so the asetrate→atempo pitch math is exact.
function buildPitchedNarration(src, segments) {
  try {
    const out = path.join(__dirname, 'speech_pitched.mp3');
    const n = segments.length;
    const parts = [`[0:a]asplit=${n}${segments.map((_, i) => `[s${i}]`).join('')}`];
    segments.forEach((s, i) => {
      const p = s.pitch || 1.0;
      parts.push(`[s${i}]atrim=${s.start.toFixed(3)}:${s.end.toFixed(3)},aresample=44100,asetrate=${Math.round(44100 * p)},aresample=44100,atempo=${(1 / p).toFixed(4)}[a${i}]`);
    });
    parts.push(`${segments.map((_, i) => `[a${i}]`).join('')}concat=n=${n}:v=0:a=1[out]`);
    execFileSync('ffmpeg', ['-y', '-i', src, '-filter_complex', parts.join(';'), '-map', '[out]', out], { stdio: 'ignore' });
    return out;
  } catch (e) {
    console.warn('pitch-shift failed, using original narration:', e.message);
    return src;
  }
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
  const audioFile = (hasAudio && Array.isArray(cfg.pitchSegments) && cfg.pitchSegments.length)
    ? buildPitchedNarration(AUDIO, cfg.pitchSegments) : AUDIO;
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

  // ---- audio mix: delayed narration + looped low-volume music bed ----
  const map = ['-map', `[${vlabel}]`];
  const audioParts = [];
  if (hasAudio) {
    inputs.push('-i', audioFile);
    filters.push(`[${i}:a]adelay=${delayMs}|${delayMs},volume=1.0[narr]`);
    audioParts.push('[narr]'); i++;
  }
  if (hasMusic) {
    inputs.push('-stream_loop', '-1', '-i', musicFile);
    filters.push(`[${i}:a]volume=${musicVol}[bed]`);
    audioParts.push('[bed]'); i++;
  }
  if (audioParts.length === 2) {
    filters.push(`${audioParts.join('')}amix=inputs=2:duration=longest:normalize=0[aud]`);
    map.push('-map', '[aud]');
  } else if (audioParts.length === 1) {
    // single source — relabel to [aud]
    filters.push(`${audioParts[0]}anull[aud]`);
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
    OUTPUT,
  ];

  console.log(`Compositing final video (narration offset ${S.toFixed(2)}s${hasMusic ? `, music bed @ ${musicVol}` : ''})...`);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`Final video written: ${OUTPUT}`);
}

main();
