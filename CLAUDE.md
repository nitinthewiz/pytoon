# CLAUDE.md — pytoon pipeline context

This file is for AI assistants. It describes how this repo is used in production, beyond what the original README covers.

---

## What this repo actually does

This is a forked/extended version of pytoon, adapted into an automated daily news video pipeline. The original library (lip-sync animation) is intact; everything at the root level is the pipeline layer built on top of it.

**Output:** Portrait MP4 **1080×1920 (9:16)** — a multi-scene news *show*: **Opening → Headlines → Story segments → Closing**, with the **James Newshound** cartoon avatar keyed into a studio set, word-by-word captions, and a music bed. Posted to Telegram daily.

> **This is now a "production template", not a single slideshow.** Mental model:
> **Production × Theme × Talent(overlay)** — read **`TEMPLATES.md`** (the concept) and
> **`productions/daily-news/TEMPLATE.md`** (the technical template) first. Brand:
> `../News_Programs/James_Newshound/` (`personality.md`, `brand.yaml`, and
> `PIPELINE_UPGRADES.md` — prompt/asset upgrade plan). Themes: **`newshound`** (studio-box
> story), **`newshound-fb`** (full-bleed photo + James over a gradient — more immersive),
> **`classic`** (fallback). Switch via `production.json` `"theme"`. Branch: `news-show-scenes`.

---

## End-to-end pipeline

```
n8n (9:30 AM)
  → fetches news (MediaStack API)
  → LLM categorizes + writes narration (DeepInfra / MiniMax-M2.5)
  → Kokoro TTS generates speech.mp3 + word timestamps (/dev/captioned_speech)
  → uploads MP3 to MinIO
  → dispatches GitHub Actions with base64-encoded inputs

GitHub Actions (self-hosted Windows runner)
  → downloads audio from MinIO
  → node build_background.js   # Remotion: renders the full show (NewshoundShow) +
  →                           #   captions; emits composite.json (timeline + music)
  → python main.py             # pytoon: renders avatar over a MAGENTA key → avatar.mp4
  → node compose.js            # data-driven ffmpeg composite: background + keyed avatar
  →                           #   + keyed captions + narration + per-scene music/stings
  → posts the video to Telegram via RAW Bot API (portrait thumb + supports_streaming)
  → uploads video + cover.png/thumb.png to MinIO; POSTs the callback → n8n WF4 (Publish)
```

The avatar is a **keyed overlay layer**, not baked into the background — so pytoon can
later be swapped for D-ID / HeyGen / etc. by producing a different `avatar.mp4`.

---

## GitHub Actions workflow (`.github/workflows/main.yml`)

Triggered via `workflow_dispatch` with 5 base64 inputs:

| Input | Decoded to | Contents |
|-------|-----------|---------|
| `audio_input` | — | MinIO filename of speech.mp3 (or "speech.mp3" to use checked-in file) |
| `news_b64` | `news.json` | Array of `{title, image}` news items |
| `speech_b64` | `speech.txt` | Narration text with `[ITEM:N]` story boundary markers |
| `captions_b64` | `captions.json` | Kokoro word-level timestamps |
| `emotions_b64` | `emotions.json` | LLM-assigned emotion name per story |

If `news_b64` is empty, Remotion step is skipped and the checked-in `background_video.mp4` is used as fallback.

---

## Key files

| File | Purpose |
|------|---------|
| `productions/daily-news/production.json` | **The template config** — single source of truth (canvas, theme, brand, voice, scene order) |
| `productions/daily-news/TEMPLATE.md` | How the production template works + how to make variants |
| `main.py` | pytoon: expand numbers, build emotion schedule, animate(), export avatar over MAGENTA key → `avatar.mp4` |
| `build_background.js` | Remotion orchestrator: caption-aligned slide timing, render show + captions by theme, emit `composite.json` |
| `compose.js` | Data-driven final ffmpeg composite (layers + audio mix), driven by `composite.json` |
| `remotion/src/production.ts` | Typed loader for `production.json` (canvas, colours, theme); `layout.ts` + `main.py` read it |
| `remotion/src/themes/newshound/` | **Active theme** — `Opening`, `Headlines`, `Story`/`Stories`, `Closing`, `Captions`, `Show.tsx`, `Furniture.tsx` |
| `remotion/src/themes/newshound.ts` | Newshound palette + `BRAND` constants (from `brand.yaml`) |
| `remotion/src/Show.tsx`, `scenes/*`, `NewsSlideshow.tsx` | **classic** theme (fallback) |
| `remotion/src/CaptionsOverlay.tsx` | classic green-screen captions (newshound has its own `Captions.tsx`) |
| `remotion/public/james*.png` | James mascot stills (pytoon poses) for Opening/Closing |
| `pytoon/animator.py` | Core animation engine: pose sequencing, frame compositing, export |
| `pytoon/lipsync.py` | Forced alignment → viseme sequences |
| `pytoon/dataloader.py` | Loads pose_data.json, emotion/pose/mouth coordinate structs |
| `pytoon/assets/pose_data.json` | 6 emotions × ~7 poses each |
| `pronunciation.json` | Kokoro pronunciation overrides (applied as Markdown IPA in n8n before TTS) |
| `DECISIONS.md` | Running log of architectural decisions and alternatives evaluated |

Local end-to-end run (Mac): venv in `venv/` (py3.13, needs `torchcodec`); `node build_background.js` → `venv/bin/python main.py` → `node compose.js` → `animation.mp4`. Inputs (`news.json`/`speech.txt`/`captions.json`/`emotions.json`/`speech.mp3`) are gitignored; pull real ones from an n8n execution (see git history / the n8n MCP).

---

## pytoon animation engine

**Input:** `speech.mp3` + transcript (number-expanded) + emotion schedule

**Pipeline:**
1. `forcealign` maps each word → exact time range + ARPAbet phonemes
2. ARPAbet → 8 simplified visemes (A, AU, AY, F, M, T, U, Y) → PNG mouth image sequences
3. Two mouth image sets: `positive/` (explain, happy, rhetorical) and `negative/` (sad, angry)
4. Per frame: random pose from emotion-appropriate set, blink management (every 3s, 160ms), mouth composited at pose's mouth coordinates
5. MoviePy → ffmpeg → MP4 at 48 FPS

**Emotions:** explain, happy, rhetorical, sad, angry, confused

**Export (`main.py`):** avatar is rendered over a **magenta key** (`#FF00FF`), NOT baked
over the news background — sized to 75% of canvas width (810px), centred, cropped to the
704px avatar zone, anchored top. `compose.js` keys out the magenta and stacks it onto the
Remotion background at the narration offset. Magenta avoids the captions' green key and
the character art. (Canvas/avatar values come from `production.json`.)

---

## Remotion compositions (canvas **1080×1920** @ 30 FPS)

Geometry constants are in `remotion/src/layout.ts`; canvas + colours come from
`production.ts` (→ `production.json`). The avatar zone is the **top 704px**
(`AVATAR_ZONE_H`) — narration scenes keep it as a studio backdrop for the keyed avatar.

The active theme is **newshound** (`remotion/src/themes/newshound/`), assembled by
`Show.tsx` as a `TransitionSeries`: **Opening → Headlines → Stories → Closing**.

- **`NewshoundShow`** (id) — the full show. `build_background.js` renders this for newshound.
- **Opening** — charcoal cold-open: James mascot, NEWSHOUND/NEWS wordmark, tagline (music only).
- **Headlines** — "THE RUNDOWN": studio zone (avatar) + numbered rundown list; plays under the intro narration.
- **Story** (one per news item, in `Stories`) — studio/avatar zone, LIVE + category bugs, "JAMES NEWSHOUND // THE TAKE" lower-third + all-caps chyron (`item.take ?? title`), Ken-Burns news image, story-progress pips, scrolling ticker.
- **Closing** — James + "STAY SKEPTICAL." sign-off.
- **`NewshoundCaptions`** — green-screen (`#00FF00`) caption pop-ons; Inter heavy, active word = Newshound Yellow `#FFC01E`, ink outline; positioned at `CAPTION_TOP`.

Classic theme (`Production`, `NewsSlideshow`, `CaptionsOverlay`, `scenes/*`) is kept as a fallback.

---

## Timeline sync — the absolute-frame model (`build_background.js`)

**The most load-bearing thing in the renderer. Read this before touching timing.**

The audio and the visuals share **one absolute-frame timeline anchored to the Kokoro
caption word-timestamps** — the same timestamps the on-screen captions use, so there is
a **single source of truth** and the two can't drift. (This replaced the old
"duration + transition-bonus" model, where audio and visual timelines were computed
independently and drifted worst at the end — the sign-off audio playing over the wrong
scene.)

1. Captions are built **first** (`buildCaptionsFromKokoroWithText`) — one entry per
   original word, number-expansion-aware (see "caption matching" below).
2. `computeSegmentStartSecs` reads each `[ITEM:N]` segment's first word straight from
   that captions array → exact per-story start times (with a monotonic safety net).
3. `computeTimeline()` lays **every scene** as a contiguous, non-overlapping window
   `[startFrame, endFrame)` on the final video timeline: each story/closing start =
   `round((narrationStart + segmentFirstWordSec) * fps)`. The **Closing absorbs all
   residual slack** so the video can never under-run the audio.
4. **Transitions are OVERLAYS, not timeline-consumers.** `ShowLayout.tsx` renders each
   scene as a plain `<Sequence from=… durationInFrames=…/>` at those exact frames (no
   `TransitionSeries`, nothing eating boundary frames); the stinger wipes / section
   cards / scene flashes are drawn *on top of* the hard cuts. This is why a transition
   can never desync the rest of the show.
5. Narration **starts at the Headlines scene** (the intro teases the rundown). The
   offset (`narrationStartSec`, plus the `hookOverlapSec` knob in `production.json`,
   currently 0 = the ~2s opening sting plays out first) is set so story-1's narration
   lands on the Stories-scene start. `compose.js` delays the avatar/captions/audio by
   `narrationStartSec` and bounds them to the narration window (so pytoon's ~2s over-run
   doesn't bleed into Closing).

### Build-time SYNC ASSERTION (fails the Action on drift) — intentional fail-loud

`assertTimelineSync()` **throws** (failing the GitHub Action) on any timeline drift or
collapse, and prints a **SYNC REPORT table** in the Action log so every render *proves*
sync instead of us eyeballing it. A failed build here is the assertion doing its job —
it is NOT a flaky build. It checks two independent kinds of thing:

- **Contiguity / anchoring** (±2 frames): scenes are contiguous, each anchored to its
  audio, the stories-block starts at `narrationStart + intro`, total ≥ narration end.
- **Non-circular geometry guards (5a–5d)** — frame geometry + word counts only, *not*
  the caption lookup, so a collapse can't pass: every story scene ≥ `MIN_STORY_LEN_FRAMES`,
  consecutive starts ≥ `MIN_STORY_GAP_FRAMES` apart and increasing, the last story starts
  before `narrationEnd − its min length`, and each story's allotted seconds is within
  `STORY_SHARE_FACTOR` (6×) of its word-count share. **This non-circularity was a real
  bug fix:** the original assertion compared scene starts against an audio anchor *derived
  from the same caption→segment mapping*, so it printed "SYNC OK" even on a fully collapsed
  timeline. (`.test/` carries the regression fixture + a proof that the new assertion
  catches the old collapse.)

The **classic** theme keeps the legacy duration path (no timeline, no assertion).
Fallback (no captions.json): proportional word-count allocation.

---

## Number expansion (`main.py`)

`forcealign` silently drops digits, so numbers are pre-expanded to match Kokoro's spoken form:
- `"2026"` → `"twenty twenty-six"`
- `"13th"` → `"thirteenth"`
- `"$50.25"` → `"fifty point two five"`
- `"237%"` → `"two hundred thirty-seven percent"`

---

## Caption word→token matching — the KNOWN FRAGILITY (`buildCaptionsFromKokoroWithText`)

This is the one genuinely fragile layer in the renderer, and everything above (timeline,
slide timing, the audio mix) keys off it. **The permanent fix is the Chatterbox +
whisperX per-story TTS migration** (see below), which gives exact per-story boundaries +
real word timestamps and **deletes this whole matching layer.** Until then:

**Why it's hard:** the script has more *words* than Kokoro emits *tokens* — Kokoro voices
no token at all for pure-punctuation words (the spunky scripts' standalone "-"/"—" aside
markers) and *expands* numbers into several tokens ("2026" → "twenty twenty-six"). So
there is no 1:1 mapping; the matcher has to keep the script's words and Kokoro's tokens
aligned as it walks both. On long scripts a naive matcher **drifts** — and a drift that
runs the cursor off the end of the token stream collapses every later scene onto one
instant (stories flash past, captions freeze, audio desyncs). This has bitten us twice
(us-AM 2026-06-11; a 222-word/206-token edition).

**Current mitigations (one caption per original word, always):**
- **Stay on the proportional diagonal.** `diagTok(vi) = round(vi * wordToks / voicedCount)`
  is the token index each voiced word *should* sit at. The matcher RE-ANCHORS the cursor
  back onto the diagonal when drift pushes it past `DIAG_SLACK` ahead, and lets a word
  CONSUME 0 tokens (share the current one) when token-starved. A one-sided "never
  overshoot" cap is **insufficient** — with more words than tokens every word still
  advances ≥1 and the cursor walks off the end regardless. This two-sided guard is the
  load-bearing change.
- **Pure-punctuation words** consume no token (zero-width caption; Unicode letters count
  as voiced, so Hindi words never hit this branch).
- **Tight resync:** a small bounded window (`RESYNC_WINDOW` 5) prefers an *exact* alpha
  match and only falls back to a short prefix match — so common short next-words
  ("the"/"to"/"and") can no longer false-anchor and swallow a dozen tokens at once.
- **Deficit tail:** if tokens genuinely run out, the remaining words are spread across the
  leftover audio with a strictly-increasing floor (never a shared instant).

The **non-circular build SYNC ASSERTION** (above) is the backstop: any residual collapse
**fails the Action** rather than shipping. The *small* residual drift on long scripts
(up to ~1-2s on later stories) is watchable now and only fully disappears with the
migration. **Do not "fix" this matcher by widening the window** — that's exactly what
caused the collapses; the real fix is to stop matching at all (Chatterbox+whisperX).

### The permanent fix — Chatterbox + whisperX per-story TTS (planned, gated on the GPU box)

Replacing Kokoro with **per-story Chatterbox TTS** (expressive — emotion via
`exaggeration`) + **whisperX** word timestamps removes the heuristic entirely: each story
is synthesized separately, so story boundaries are exact and word timestamps are real.
A shim mimics Kokoro's `{audio, timestamps}` response so n8n + the renderer barely change,
and `buildCaptionsFromKokoroWithText` / the diagonal matcher get **deleted**. This also
fixes the flat Kokoro audio. Gated on the 5070 Ti box (see root `PENDING.md`).

---

## Per-scene audio engine (`compose.js`)

The final ffmpeg composite builds a **per-scene music mix** from the scene timeline in
`composite.json` (NOT one looped bed): the opening logo sting, a rundown bed under
Headlines, an **emotion-matched bed per story** (`storybed_<emotion>_N`), transition
stingers at story cuts, and an outro bed + sign-off sting under Closing. Variants rotate
per run via `audioSeed`. (The classic theme falls back to a single looped bed.)

**Mix levels are data, not code** — they live in
`productions/daily-news/production.json` → the **`audio`** block (`openingSting`, `beds`,
`storyStingers`, `closingBed`, `signOff`). `compose.js → loadAudioLevels()` reads the
block (with identical built-in defaults if it's absent), so tuning a level needs only
`node compose.js` to re-mix — **no Remotion re-render**. The mix is ffmpeg-4.x-safe
(the runner has ffmpeg 4.x: `amix` uses `1/n` + a `volume` boost, since `normalize=0`
needs ffmpeg ≥5). The opening sting is duck-free but level-tuned (LogoSting1 is mastered
near 0 dBFS, so it sits at 0.75 to avoid clipping the master against the narration hook).

## Story chyron & section stingers (newshound theme)

- **Dynamic story chyron** (`themes/newshound/Story` + `Sections`): a small plate shows
  the **topic** (`teaser`, black) ` // ` **one-liner** (`take`, orange); the big white
  text is the **actual news headline** (`title`, 3-line clamp) overlapping the photo.
  One cyan category/section badge (the duplicate `SectionBadge` was removed). Falls back
  to the raw title when `take` is absent.
- **Two visually distinct transitions** (both overlays, zero timeline impact):
  - **yellow `StingerWipeOverlay`** on every *story → story* cut;
  - a **blue `SectionStingerOverlay` + blue `SectionCard`** (NEXT UP / SPORTS / THE FUN
    STUFF, Anton) on *section-boundary* cuts (top → sports → fun). `ShowLayout` picks
    blue when `sectionOf(prev) !== sectionOf(next)`. Non-top stories also wear a small
    persistent section badge. See `TEMPLATE.md` → "Sections — the 5+3+2 show".

## Telegram video post — RAW Bot API on the runner (NOT n8n)

The 9:16 video is provably 1080×1920 SAR 1:1, but Telegram's inline player **squishes
vertical video** unless it gets a portrait thumbnail + `supports_streaming` + explicit
width/height. The n8n Telegram node and `xireiki` send none of these, so both squished
identically. **The video is therefore posted from the GitHub Action (`.github/workflows/
main.yml`) via the raw Telegram Bot API** with a 9:16 thumbnail + `supports_streaming`.
The n8n video post was removed from WF4 (it now posts only the cover + future channels);
`xireiki` is legacy-only. Don't re-add a video post in n8n.

## Cover / thumbnail (on the runner → MinIO)

The per-post cover is generated **on the runner**, not by the VPS thumbnail service —
the n8n host can't reach that service (egress restricted to standard ports), and the
runner already has the manifest + a built video. `cover/` is a PIL generator
(`make_cover.py` reads `manifest.json` → writes `cover.png` 1080×1920 + `thumb.png`
1280×720 from story 1's image/take/emotion + the edition date). The hook text uses
DeepInfra when `DEEPINFRA_API_KEY`/`DEEPINFRA_KEY` is set, else a graceful local fallback
(trimmed take); it never fails the build. `main.yml` uploads `cover.png`/`thumb.png` to
MinIO next to the video (`covers/NAME.png`, `thumbs/NAME.png`); n8n WF4 S3-downloads the
cover and posts it.

---

## Known constraints

- Runner is **self-hosted Windows** — PowerShell used for base64 decoding, paths use backslashes in some places
- n8n v2 workflows are edited **via the SDK/MCP** (`update_workflow`), and credential pins (`{id,name}` in the `.sdk.js` CREDS maps) survive the update — never re-attach in the UI. ⚠️ But an **active** workflow runs its *published* version: after `update_workflow` you must `publish_workflow` for the change to go live (see `n8n/README.md`)
- `forcealign` requires NLTK corpus download on first run (handled in workflow)
- Remotion Chrome Headless Shell is cached in GitHub Actions to avoid re-downloading (~300MB)
- pytoon is CPU-only by design; no GPU alternatives exist that are open-source + end-to-end for cartoon characters
- **MediaStack can return 0 results** (rate limit, transient outage, or date-boundary edge case). When this happens `build_background.js` exits early without creating `captions_overlay.mp4`, and the composite ffmpeg step is skipped via a `Test-Path` guard — the run continues with the checked-in fallback `background_video.mp4`

---

## Alternatives evaluated (see DECISIONS.md for full notes)

- **MuseTalk / LatentSync / Wav2Lip** — GPU required, photorealistic only, not suitable for cartoon
- **Rhubarb Lip Sync** — timing only, no renderer
- **Hedra (Character-3)** — commercial API, ~$0.45/min, supports cartoon
- **Replicate MuseTalk** — next candidate to evaluate for pytoon replacement
- **ffmpeg concat demuxer** — considered instead of Remotion; harder to animate transitions and captions

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **pytoon** (480 symbols, 595 relationships, 6 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/pytoon/context` | Codebase overview, check index freshness |
| `gitnexus://repo/pytoon/clusters` | All functional areas |
| `gitnexus://repo/pytoon/processes` | All execution flows |
| `gitnexus://repo/pytoon/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
