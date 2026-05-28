# CLAUDE.md — pytoon pipeline context

This file is for AI assistants. It describes how this repo is used in production, beyond what the original README covers.

---

## What this repo actually does

This is a forked/extended version of pytoon, adapted into an automated daily news video pipeline. The original library (lip-sync animation) is intact; everything at the root level is the pipeline layer built on top of it.

**Output:** Portrait MP4 (1080×1920, 9:16) — news image slideshow on top, talking cartoon avatar on bottom, word-by-word captions overlaid. Posted to Telegram daily at ~9:30 AM.

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
  → node build_background.js      # Remotion: renders background + captions
  → python main.py                # pytoon: renders avatar animation
  → ffmpeg colorkey composite     # overlays captions onto animation
  → uploads artifact + posts to Telegram
```

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
| `main.py` | Entry point: expand numbers, build emotion schedule, run animate(), export |
| `build_background.js` | Orchestrates Remotion: download images, compute slide timing, render both compositions |
| `remotion/src/NewsSlideshow.tsx` | Top-half image slideshow with fade/slide/flip transitions |
| `remotion/src/CaptionsOverlay.tsx` | Green-screen TikTok-style captions (composited in ffmpeg) |
| `remotion/src/transitions.ts` | Transition animation definitions |
| `pytoon/animator.py` | Core animation engine: pose sequencing, frame compositing, export |
| `pytoon/lipsync.py` | Forced alignment → viseme sequences |
| `pytoon/dataloader.py` | Loads pose_data.json, emotion/pose/mouth coordinate structs |
| `pytoon/assets/pose_data.json` | 6 emotions × ~7 poses each |
| `pronunciation.json` | Kokoro pronunciation overrides (applied as Markdown IPA in n8n before TTS) |
| `DECISIONS.md` | Running log of architectural decisions and alternatives evaluated |

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

**Export:** avatar overlaid on background video, scaled to 75% of canvas width (810px), centred horizontally, cropped to 640px height, anchored to the top of the avatar zone. The 135px of studio background visible on each side prevents the character from appearing squat/wide.

---

## Remotion compositions

Canvas is **1080×1920 (9:16)** @ 30 FPS, scaled from the original ToonVertical2.svg (1080×2355) at factor 0.8152. All layout constants are in `remotion/src/layout.ts`.

**`NewsSlideshow`**:
- `0–640px` (AVATAR_ZONE_H): studio background behind avatar — static, no Remotion content
- `640–873px`: white headline card (flexbox-centred text, Impact font, 58px) overlapping a green accent bar; card floats over the top of the news image
- `803px–bottom` (IMAGE_Y): news image zone
- Bottom 72px (BOTTOM_BAR_H): static ticker bar — "AMOS NEWS | [date] | AM/PM EDITION" — always visible, rendered over all slides
- "TOP NEWS" green badge pinned top-left at y=600px
- `TransitionSeries` with transitions selected deterministically (`i % APPROVED_TRANSITIONS.length`); 15-frame crossfade between slides (TRANSITION_FRAMES)

**`CaptionsOverlay`** (same dimensions):
- Green screen background (`#00FF00`) for ffmpeg `colorkey` compositing
- Words grouped into pages (within 1200ms windows)
- Active word: yellow `#FFE81A`; others: white
- Positioned at y=1480px (CAPTION_TOP — avatar chest level)

---

## Slide timing algorithm (`build_background.js`)

Uses `captions.json` (Kokoro word timestamps):
1. Strip `[ITEM:N]` markers to get plain words; count words per segment
2. Map cumulative word count → Kokoro token index at each segment boundary
3. Read `start_time` of first token in each segment → slide start in seconds → frames at 30 FPS
4. Add `TRANSITION_FRAMES` (15) overlap between slides

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

Kokoro expands numbers into multiple tokens. The function uses greedy lookahead: consume tokens until the next original word is recognized, accumulating the time span. **Edge case:** consecutive digit words (e.g., "13th, 2026") — if the lookahead target has fewer than 2 alphabetic characters, the greedy loop is skipped to prevent consuming all remaining tokens.

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

This project is indexed by GitNexus as **pytoon** (424 symbols, 527 relationships, 6 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
