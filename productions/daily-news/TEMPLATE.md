# Daily News — Production Template

The single source of truth for one **production** (a show). A production = brand +
canvas + voice + an ordered list of **scenes**, rendered by the pipeline into one
9:16 video. This folder *is* the template; `production.json` is its config.

> Brand soul lives in `News_Programs/James_Newshound/personality.md` + `brand.yaml`.
> This file is the *technical* template: how those values become a video.

---

## Vocabulary

| Term | Meaning | Examples |
|------|---------|----------|
| **Production** | A show = brand + canvas + voice + scene order | Daily News, India News (later) |
| **Scene (type)** | A reusable Remotion layout | `opening`, `headlines`, `stories`, `closing` |
| **Theme** | A visual skin applied to the scenes | `newshound` (active), `classic` (fallback) |
| **Overlay layer** | A keyed video composited over the scenes | pytoon avatar, captions (swappable) |

---

## `production.json` schema

```jsonc
{
  "id": "daily-news",
  "theme": "newshound",                 // which Remotion scene set + palette
  "meta":   { "brandName", "anchor", "tagline" },
  "canvas": { "width": 1080, "height": 1920, "fps": 30 },   // 9:16, the ONE place size is defined
  "colors": { ... },                    // classic-theme palette (newshound palette is in themes/newshound.ts)
  "fonts":  { "family": "Roboto" },
  "voice":  { "tts": "<kokoro voice mix>", "speed": 1 },     // read by n8n later; the common thread
  "scenes": [                            // ORDER = play order
    { "type": "opening",  "durationSec": 4 },   // fixed; music-only cold open
    { "type": "headlines","durationSec": 6 },   // duration overridden by intro-narration length
    { "type": "stories" },                      // duration derived from the audio
    { "type": "closing",  "durationSec": 4 }    // fixed; sign-off
  ],
  "avatar": { "widthPct": 0.75, "cropHeight": 704, "presentScenes": ["headlines","stories"] },
  "sceneTransition": { "durationFrames": 20 }   // overlap between scenes
}
```

`production.ts` (Remotion) and `main.py` (pytoon) both read this — **canvas size is
defined once**, never duplicated.

---

## The scene contract

A scene is a React component that fills the 1080×1920 frame. The avatar zone is the
**top 704px** (`AVATAR_ZONE_H`) — the pytoon avatar is keyed in there later by ffmpeg,
so narration scenes (`headlines`, `stories`) keep that zone as a studio backdrop and
put their content below. `opening` / `closing` are full-frame (no avatar).

Scene set per theme lives in:
- `remotion/src/themes/newshound/` → `Opening`, `Headlines`, `Stories`→`Story`, `Closing`, `Captions`, assembled by `Show.tsx`.
- classic equivalents under `remotion/src/scenes/` + `Show.tsx`.

`build_background.js` picks `NewshoundShow`/`NewshoundCaptions` vs `Production`/`CaptionsOverlay` by `theme`.

---

## Timeline & audio alignment

One continuous narration (`speech.mp3` + Kokoro `captions.json`) is the spine.

- **Opening** plays music only (cold open).
- **Narration starts at Headlines** — the intro ("Tonight, we explore…") teases the
  rundown, then flows into the stories.
- Per-story slide durations come from the **caption word-times** (`build_background.js
  → computeSegmentDurations`), so each story slide holds exactly while James talks
  about it. Story `[ITEM:N]` markers map narration → news item.
- **Cold-open hook**: `hookOverlapSec` (production.json) starts the narration that many
  seconds *before* the opening hands off (the first line plays over the splash); the
  headlines scene shrinks by the same amount so story-1 still lands on the Stories start.
- `compose.js` offsets the avatar + captions + audio to the narration start and builds
  a **per-scene music mix** from the scene timeline: opening logo sting, a rundown bed
  under headlines, an emotion-matched bed per story (`storybed_<emotion>_N`), transition
  stingers at story cuts, outro bed + sign-off sting under the closing. Variants rotate
  per run via `audioSeed`. (Classic theme falls back to one looped bed.)

`composite.json` (emitted by `build_background.js`) carries `narrationStartSec`,
`narrationDurationSec`, key colours, the scene timeline (`scenes`, `storyBoundaries`,
`audioSeed`) — or a `music` config for the classic fallback. `compose.js` is fully
data-driven from it.

---

## Layers (final composite)

```
background_video.mp4   Remotion: the full show (all scenes), music-less
  + avatar.mp4         pytoon avatar over a MAGENTA key (swap for D-ID/HeyGen later)
  + captions_overlay   green-keyed caption pop-ons
  + speech.mp3         narration (delayed to narration start)
  + scene audio        per-scene beds/stings from assets/audio (classic: one looped bed)
        ↓ compose.js (ffmpeg, data-driven from composite.json)
   animation.mp4        final 9:16 video
```

---

## Making a variant (later)

1. Copy `productions/daily-news/` → `productions/<new>/`, edit `production.json`
   (brand, voice, theme, scene order, durations).
2. Add a theme under `remotion/src/themes/<theme>/` if the look differs, and register
   its compositions in `Root.tsx`.
3. Point the pipeline at the new production folder (currently hard-coded to
   `daily-news` in `build_background.js` / `main.py` — make this an input when we add
   the n8n `template` dispatch param).

The n8n `IndiaNews-Hindi` workflow is the first real variant candidate.

---

## Open items

- `take` chyron currently falls back to the raw news title — the script/prompt work
  will feed James's actual *take* per story.
- Production-folder selection is hard-coded; add a `template` dispatch input.
