# Architectural Decisions & Alternatives

A running log of choices made in the pipeline and options that were considered but deferred.

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

## News API

**Current:** MediaStack free tier (`api.mediastack.com/v1/news`).

**Alternatives considered:**
- **GNews** — 71 countries, 41 languages, but 100 req/day free and 12-hour delay on free tier.
- **Currents API** — 1,000 req/day free, real-time, 70+ countries.
- **TheNewsAPI** — 3 req/day free, no payment required.

No switch made — MediaStack is sufficient once the bias issue is resolved.
