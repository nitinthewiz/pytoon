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
  "hookOverlapSec": 0,                  // cold-open hook: narration starts this many sec BEFORE the opening ends (0 = sting finishes first)
  "audio": {                            // music mix levels — tweak audio levels here, no code (read by compose.js)
    "openingSting": 0.75,               //   LogoSting under the cold open
    "beds": 0.16,                       //   headlines rundown bed + per-story emotion beds
    "storyStingers": 0.05,              //   transition stingers at story cuts
    "closingBed": 0.05,                 //   outro bed under the closing
    "signOff": 0.05                     //   sign-off sting capping the show
  },
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
  **Currently 0**: the opening sting (~2s) plays out fully, then narration starts exactly
  at the opening→headlines handoff (narrationStart = opening length).
- `compose.js` offsets the avatar + captions + audio to the narration start and builds
  a **per-scene music mix** from the scene timeline: opening logo sting, a rundown bed
  under headlines, an emotion-matched bed per story (`storybed_<emotion>_N`), transition
  stingers at story cuts, outro bed + sign-off sting under the closing. Variants rotate
  per run via `audioSeed`. (Classic theme falls back to one looped bed.)
- **Music levels** come from production.json → `"audio"` (see schema above) — tweak
  audio levels here, no code. compose.js reads the block directly at composite time, so
  a level change only needs `node compose.js` to re-mix (no Remotion re-render).
  compose.js carries identical defaults for when the block is missing.

`composite.json` (emitted by `build_background.js`) carries `narrationStartSec`,
`narrationDurationSec`, key colours, the scene timeline (`scenes`, `storyBoundaries`,
`audioSeed`) — or a `music` config for the classic fallback. `compose.js` is fully
data-driven from it (mix levels come from production.json `audio`).

---

## Sections — the 5+3+2 show

`news[]` scales to any story count (5 classic, 10 in the "5 top + 3 sports +
2 entertainment" format). Items may carry `section: 'top' | 'sports' |
'entertainment'` (absent = `top`), grouped in that order; `[ITEM:1..N]` markers,
`takes`/`emotions`/`tags` are length N; `teasers` stay top-only (5).

Sections are **purely visual** — the narration is one continuous track, so a
section break must never add a scene (it would desync every later slide). Instead
(`remotion/src/themes/newshound/Sections.tsx`, used by the `newshound-fb` show):
- the **first story of a new section** gets a full-frame branded **divider card**
  overlayed on its first ~35 frames ("NEXT UP / SPORTS" / "THE FUN STUFF" in Anton)
  that sweeps off to reveal the story already running beneath — **zero timeline
  impact**. The section cut is rendered in a distinct **BLUE** tone — a blue
  `SectionStingerOverlay` band + blue `SectionCard` — so it reads clearly differently
  from the **yellow** `StingerWipeOverlay` used on ordinary story → story cuts.
  `ShowLayout` picks blue whenever `sectionOf(prev) !== sectionOf(next)`;
- non-top stories wear a small persistent **section badge** (SPORTS / FUN) under
  the category bug;
- the rundown lists only the **top-section teasers** (max 5) plus one static
  yellow row: *"...plus sports and the fun stuff."*

Sectionless 5-story manifests render exactly as before (regression-guarded).

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

- Production-folder selection is hard-coded to `daily-news`; add a `template` dispatch
  input when the second production (e.g. India/Hindi) goes live.

> Done since the first draft: the story chyron now shows the writer's real *take*
> (topic // one-liner + the actual headline), not the raw title; the `audio` mix block
> and the 5+3+2 `section` format (with the blue section stinger) are live.
