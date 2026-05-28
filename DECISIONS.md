# Architectural Decisions & Alternatives

A running log of choices made in the pipeline and options that were considered but deferred.

---

## Canvas aspect ratio: 9:16 (1080×1920)

**Decision:** Rescale the Remotion canvas from the original 1080×2355 (ratio ~1:2.18) to standard 9:16 (1080×1920). All layout constants in `layout.ts` were multiplied by 1920/2355 ≈ 0.8152.

**Why:** Telegram aggressively crops very tall portrait videos in chat preview — only the top ~40% was visible as thumbnail. Standard 9:16 renders correctly in Telegram's inline player and preview thumbnail.

**Alternative:** Keep 1080×2355 and rely on the full-screen player. Rejected — the cropped thumbnail looked broken and gave no visual signal of the video content.

---

## Avatar scale and position

**Decision:** Scale avatar to 75% of canvas width (810px), cropped to 640px height, centred horizontally, anchored to the top of the avatar zone. In `main.py`: `AVATAR_WIDTH = int(CANVAS_W * 0.75)`, `position=("center", "top")`.

**Why:** Rendering at full canvas width (1080px) in a 1080×640 crop zone produced a nearly-square visible frame, making the cartoon character look squat and wide. At 75% width, 135px of studio background is visible on each side, giving a portrait bust appearance and matching the original SVG intent.

**Alternative:** Anchoring bottom-right (the original behaviour) with full width. Rejected — character appeared off-centre and disproportionately wide.

---

## Headline card text alignment

**Decision:** Headline text is vertically centred in the white card using CSS `display: flex; alignItems: center` rather than a fixed `HEADLINE_Y` pixel offset.

**Why:** The fixed offset positioned text near the top of the card, leaving unequal whitespace. Flexbox centering is robust to varying text length and font rendering differences across render environments.

**Alternative:** Calculate `HEADLINE_Y` as card midpoint minus half the font metrics. Brittle — line-height and multi-line wrapping make this hard to get right without runtime measurement.

---

## Bottom ticker bar

**Decision:** Add a static 72px ticker bar at the bottom of `NewsSlideshow` showing "AMOS NEWS | [current date] | AM/PM EDITION". Date and AM/PM computed at Remotion render time via `new Date()`.

**Why:** The original SVG design included this bar for branding. It was missing from the initial port to Remotion.

---

## Captions overlay crash guard (`Test-Path`)

**Decision:** Wrap the ffmpeg captions composite step in `main.yml` with `if (Test-Path captions_overlay.mp4)`. If the file doesn't exist, log a message and skip.

**Why:** `build_background.js` has multiple early-return paths (no news items, zero story segments, audio read failure, all images fail). When it exits early, `captions_overlay.mp4` is never created. The unconditional ffmpeg composite step then crashed with "No such file or directory", failing the entire GitHub Actions run. This caused 3 consecutive daily failures (May 25–27, 2026).

---

## MediaStack: Australia-centric results

**Symptom:** `sort=popularity` with no `countries` parameter returns AU-biased news, likely because the APILayer account was registered from an Australian IP and popularity is scored regionally.

**Current approach:** No change — using `sort=published_desc` is available as a drop-in swap.

**Options:**
1. Switch `sort=popularity` → `sort=published_desc` (chronological, no regional weighting). Noisier but globally unbiased.
2. Add `countries=us,gb,ca,in,de,fr,au,jp,sg,ae,za,br` to the MediaStack URL. Explicit diverse coverage, still sorted by popularity within that set.

---

## Kokoro TTS endpoint

**Decision:** Use `/dev/captioned_speech` (returns base64 audio + word-level timestamps JSON) instead of `/v1/audio/speech` (returns binary audio only).

**Why:** Word timestamps enable precise slide transition timing and accurate subtitle sync. The base64 decode overhead is negligible.

**Alternative:** Use a third-party TTS with native timestamp support (ElevenLabs, Azure TTS). Deferred — Kokoro is self-hosted and free.

---

## Kokoro pronunciation fixes

**Decision:** Inline Markdown substitution (`[word](/IPA/)`) applied in the n8n `Process Speech` node before the TTS call, driven by `pronunciation.json` fetched from GitHub at runtime.

**Why:** No server changes required; auto-updates on repo push; `speech.txt` / captions display text stays unmodified.

**Alternative:** Edit the Kokoro lexicon directly on the server (`pipelines['a'].g2p.lexicon.golds['word'] = 'IPA'`). Permanent but requires SSH access and server restart.

---

## Subtitle timing

**Decision:** Use Kokoro word timestamps from `/dev/captioned_speech` for caption timing. Original speech text words are used for display (not Kokoro's token text, which expands numbers).

**Why:** Kokoro timestamps are millisecond-accurate. Word-count proportional estimation caused subtitle lag, especially after punctuation pauses.

**Alternative:** forcealign library for post-hoc alignment. Still used for the mouth-sync animation (pytoon), but Kokoro timestamps are better for caption display since they're available at TTS time.

### Caption alignment: greedy lookahead algorithm (`buildCaptionsFromKokoroWithText`)

Kokoro's token stream doesn't map 1-to-1 with the original speech text because it expands numbers to spoken words ("2026" → "twenty", "twenty", "six") and emits punctuation as separate tokens. The function walks `origWords` (from the plain speech text) and `wordToks` (Kokoro tokens filtered to those containing `\w`) in parallel:

- **Normal word:** advance `ti` by 1. The token's `start_time`/`end_time` becomes the caption timing.
- **Digit word** (e.g. "2026", "13th"): Kokoro will have emitted multiple tokens for it. Advance `ti` by 1 to consume the first expansion token, then **greedily consume** further tokens until the next original word is recognised in the token stream — accumulating `endMs` as we go. That gives one caption entry spanning all the expansion tokens.

**Critical edge case — consecutive digit words** (e.g. "13th, 2026"): The lookahead target for "13th," is "2026.", which has no alphabetic characters after stripping punctuation (`nextBase = ""`). A `nextBase` of length < 2 means the while-loop condition can never be satisfied, so it would consume every remaining token and kill all subsequent captions. **Fix:** the greedy while loop is skipped entirely when `prefixLen < 2`; "13th," is mapped to just its first Kokoro token ("thirteenth"), accepting slightly imprecise timing for that word in exchange for captions continuing normally.

---

## Slide transition timing

**Decision:** Use Kokoro word timestamps to find the exact second each `[ITEM:N]` segment starts, convert to frames, add `TRANSITION_FRAMES` overlap bonus to all but the last slide.

**Why:** Word-count proportional estimation diverged from actual audio when sentences varied in length or had pauses.

**Alternative:** Fixed equal-duration slides. Simple but visually jarring when one story is much longer than another.

---

## forcealign transcript format

**Decision:** Strip `[ITEM:N]` markers and expand numbers/symbols via `num2words` before passing transcript to `animate()` in `main.py`.

**Why:** forcealign's `alphabetical()` filter silently drops digits, causing mis-alignment. Kokoro expands numbers the same way, so the transcript matches the audio.

---

## Background video rendering

**Decision:** Remotion (`NewsSlideshow` + `CaptionsOverlay` compositions) rendered on the GitHub Actions self-hosted runner.

**Why:** Remotion gives frame-accurate React-based video composition. The captions overlay is keyed on green (`#00FF00`) and composited with ffmpeg after pytoon produces `animation.mp4`.

**Alternative:** ffmpeg directly (slideshow via `concat` demuxer). Lower dependency footprint but harder to animate transitions and captions.

---

## pytoon replacement / lip-sync animation alternatives

**Context:** pytoon hasn't had a commit in ~2 years. Researched alternatives May 2026.

### Architecture split

- **Sprite-based (CPU, cartoon):** pytoon's approach — composites pre-drawn mouth sprites using phoneme timing. Fast, no GPU, but character is fixed.
- **Neural/diffusion (GPU, photorealistic):** MuseTalk, LatentSync, Wav2Lip etc. — modify actual video pixels to match audio. Require GPU, trained mostly on real human faces.

### Open-source options

| Tool | Type | CPU-only? | Notes |
|---|---|---|---|
| **Rhubarb Lip Sync** | Sprite timing only | Yes | MIT, active (Apr 2025). Outputs mouth-shape timing (A–H codes), no renderer included — not end-to-end. |
| **MuseTalk** (Tencent) | Neural video | No (4GB+ VRAM) | Apache 2.0, active (Mar 2025). Real-time capable at 30fps on modern GPU. Photorealistic only. **Most promising local replacement.** |
| **LatentSync** (ByteDance) | Neural video | No (8–18GB VRAM) | Apache 2.0, active (Jun 2025). Best open-source quality, some anime support. |
| **Wav2Lip** | Neural video | Technically, but painfully slow | Frozen since 2020. Best raw sync accuracy but blurry output. |
| **SadTalker** | Neural video | No | Stale since 2023. Works from a single still image. |

**CPU-only + end-to-end + open-source:** nothing viable. pytoon occupies this niche uniquely because sprite compositing requires no neural inference.

### Commercial / cloud APIs

| Service | Character type | Notes |
|---|---|---|
| **Hedra (Character-3)** | Cartoon + photorealistic | Only API explicitly supporting illustrated/cartoon characters. ~$0.45/min. |
| **Sync.so** | Photorealistic | Built by Wav2Lip creators. $0.04–0.13/sec. Best sync accuracy commercially. |
| **D-ID** | Photorealistic | Talking head from photo. v4 Mar 2026. |

### Hosted MuseTalk API options (evaluated)

- **chutes.ai** — marketplace model (others host and run). Flaky by design — no SLA, availability depends on third-party hosts. **Ruled out.**
- **fal.ai** — better reliability than chutes but output was blurry. **Ruled out.**
- **Replicate (`douwantech/musetalk`)** — worth evaluating. Different hosting model from chutes (Replicate runs the infrastructure themselves). Check whether the model is a different/better version than what fal.ai used.

**Next step:** Test Replicate's MuseTalk model quality. If output is acceptable, Replicate is the preferred hosted path over fal.ai/chutes.

---

## News API

**Current:** MediaStack free tier (`api.mediastack.com/v1/news`).

**Alternatives considered:**
- **GNews** — 71 countries, 41 languages, but 100 req/day free and 12-hour delay on free tier.
- **Currents API** — 1,000 req/day free, real-time, 70+ countries.
- **TheNewsAPI** — 3 req/day free, no payment required.

No switch made — MediaStack is sufficient once the bias issue is resolved.
