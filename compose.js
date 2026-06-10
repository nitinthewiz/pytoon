'use strict';

// Data-driven final composite. Stacks layers onto the Remotion Production
// background, each keyed and time-offset per composite.json:
//   background_video.mp4  (base — the full show: Opening → Headlines → Stories → Closing)
//   + avatar.mp4          (magenta-keyed pytoon avatar, offset to stories start)
//   + captions_overlay.mp4(green-keyed captions, offset to stories start)
//   + speech.mp3          (narration, delayed to stories start)
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

function main() {
  if (!fs.existsSync(BG)) {
    console.log('No background_video.mp4 — nothing to composite.');
    if (fs.existsSync(AVATAR)) fs.copyFileSync(AVATAR, OUTPUT);
    return;
  }

  const cfg = fs.existsSync(COMPOSITE_JSON)
    ? JSON.parse(fs.readFileSync(COMPOSITE_JSON, 'utf8'))
    : { fps: 30, storiesStartSec: 0 };
  const fps = cfg.fps || 30;
  const S = cfg.storiesStartSec || 0;
  const D = cfg.storiesDurationSec || 0;
  const delayMs = Math.round(S * 1000);
  const avatarKey = cfg.avatarKey || '0xFF00FF';
  const captionsKey = cfg.captionsKey || '0x00FF00';

  // Bound overlays to the stories window [S, S+D] so pytoon's slight over-run
  // doesn't bleed into the closing scene. Falls back to eof if D is unknown.
  const gate = D > 0 ? `:enable='between(t,${S},${S + D})'` : '';

  const hasAvatar = fs.existsSync(AVATAR);
  const hasCaptions = fs.existsSync(CAPTIONS);
  const hasAudio = fs.existsSync(AUDIO);

  const inputs = ['-i', BG];
  const filters = [];
  let vlabel = '0:v';
  let i = 1;

  if (hasAvatar) {
    inputs.push('-i', AVATAR);
    filters.push(`[${i}:v]fps=${fps},colorkey=${avatarKey}:0.30:0.10,setpts=PTS+${S}/TB[av]`);
    filters.push(`[${vlabel}][av]overlay=0:0:eof_action=pass${gate}[v${i}]`);
    vlabel = `v${i}`;
    i++;
  }
  if (hasCaptions) {
    inputs.push('-i', CAPTIONS);
    filters.push(`[${i}:v]fps=${fps},colorkey=${captionsKey}:0.40:0.10,setpts=PTS+${S}/TB[cap]`);
    filters.push(`[${vlabel}][cap]overlay=0:0:eof_action=pass${gate}[v${i}]`);
    vlabel = `v${i}`;
    i++;
  }

  const map = ['-map', `[${vlabel}]`];
  if (hasAudio) {
    inputs.push('-i', AUDIO);
    filters.push(`[${i}:a]adelay=${delayMs}|${delayMs}[aud]`);
    map.push('-map', '[aud]');
    i++;
  }

  const args = [
    '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    ...map,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    OUTPUT,
  ];

  console.log(`Compositing final video (stories offset ${S.toFixed(2)}s)...`);
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log(`Final video written: ${OUTPUT}`);
}

main();
