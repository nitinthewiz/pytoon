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
  → uploads artifact + posts to Telegram
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

## Slide timing & narration alignment (`build_background.js`)

The whole show rides one narration (`speech.mp3` + Kokoro `captions.json`):

1. Captions are built **first** (`buildCaptionsFromKokoroWithText`) — one entry per
   original word, number-expansion-aware.
2. `computeSegmentDurations` reads each `[ITEM:N]` segment's first word straight from
   that captions array → exact start times. **This is what keeps each story slide on
   screen exactly while James talks about it** (no drift from "2026" → "twenty twenty-six").
3. Newshound narration **starts at the Headlines scene** (intro teases the rundown);
   the offset is set so story-1's narration lands on the Stories-scene start. `compose.js`
   delays the avatar/captions/audio by `narrationStartSec` and bounds them to the
   narration window (so pytoon's ~2s over-run doesn't bleed into Closing).

Fallback (no captions.json): proportional word-count allocation.

---

## Number expansion (`main.py`)

`forcealign` silently drops digits, so numbers are pre-expanded to match Kokoro's spoken form:
- `"2026"` → `"twenty twenty-six"`
- `"13th"` → `"thirteenth"`
- `"$50.25"` → `"fifty point two five"`
- `"237%"` → `"two hundred thirty-seven percent"`

---

## Caption alignment edge cases (`build_background.js → buildCaptionsFromKokoroWithText`)

Kokoro expands numbers into multiple tokens ("2026" → "twenty twenty-six") and voices **no token at all** for pure-punctuation words (the spunky scripts' standalone "-" aside markers). Mapping rules (one caption per original word, always):
- **Pure-punctuation words** ("-", "—", "..."): consume no token — zero-width caption (Unicode letters count as voiced, so Hindi words never hit this branch).
- **Every other word**: if the *immediate* next word has ≥2 alphabetic chars, scan a **bounded window (15 tokens)** for its first token and span everything before it — this covers number expansions and re-syncs any drift. No match in the window → consume exactly **one** token. The bound is load-bearing: an unbounded scan once swallowed every remaining token after "18" (next word's tokens were already behind the cursor after a "-" drift), freezing captions and collapsing all later scenes (2026-06-11 us-AM edition). Anchor is the immediate next word only — scanning past digit neighbours would let "7," swallow "2026"'s expansion.
- **Tokens exhausted early**: remaining words are spread across the leftover audio span.

`computeSegmentDurations` additionally redistributes + monotonic-clamps degenerate segment starts (safety net), so slide timing can never collapse into minimum-length slides + a frozen closing.

---

## Known constraints

- Runner is **self-hosted Windows** — PowerShell used for base64 decoding, paths use backslashes in some places
- n8n changes must be made **manually** in the live n8n UI — the workflow has credential associations that make MCP updates risky
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
