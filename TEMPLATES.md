# How Templates Work

The mental model for building many different news shows from one engine. Three
independent axes you mix and match:

```
        PRODUCTION  ×  THEME  ×  TALENT(overlay)
         (content)     (look)     (the face)
```

| Axis | "The…" | What it sets | Where it lives | Examples |
|------|--------|--------------|----------------|----------|
| **Production** | what & who | brand, anchor, **voice**, canvas, **scene order** | `productions/<id>/production.json` | Daily News, India News (Hindi), World Brief |
| **Theme** | look | the scene *components* + palette/fonts | `remotion/src/themes/<theme>/` | `classic`, `newshound`, `newshound-fb` |
| **Talent (overlay)** | face | who delivers it — a keyed video layer | `main.py` / future overlay producers | pytoon cartoon (now), D-ID/MuseTalk realistic (later) |

These are **orthogonal**: a production picks a theme and a talent. Change one without
touching the others. That's the whole point — new shows are cheap.

---

## The pieces

### Production — `production.json` (single source of truth)
One file defines a show: `meta` (brand/anchor/tagline), `canvas` (1080×1920@30 — the
ONE place size is set, read by Remotion *and* `main.py`), `voice` (the common thread),
`theme`, and the ordered `scenes`. Documented in `productions/daily-news/TEMPLATE.md`.

### Theme — a set of Scenes
A theme is the visual skin: it supplies the four scene layouts and the palette.
- `classic` — the original green TV-box look (kept as fallback).
- `newshound` — James Newshound brand, studio-box story layout.
- `newshound-fb` — same brand, **full-bleed** story layout (photo fills frame, James over a gradient).

Switching is one line: `production.json` → `"theme": "newshound-fb"`. `build_background.js`
maps the theme to the right Remotion composition (`NewshoundShow` / `NewshoundShowFB` /
classic `Production`) and caption track.

### Scene — one beat of the show
Every theme implements the same four scene *types* so productions stay swappable:
`opening` → `headlines` → `stories` (one Story per news item) → `closing`. A scene is just
a React component filling the 1080×1920 frame. The **top 704px is the avatar zone** — kept
clear (studio backdrop or gradient) so the Talent layer drops in there.

### Talent (overlay) — the face, composited last
The avatar/anchor is a **keyed video layer** (`avatar.mp4`), NOT baked into the
background. `compose.js` keys it out (magenta) and stacks it on. That decoupling is what
lets a *different production* use a **realistic anchor** instead of the cartoon:
- now: **pytoon** cartoon (`main.py` → magenta-keyed `avatar.mp4`).
- later: **D-ID / HeyGen** (cheap cloud, ~$6/mo) or **MuseTalk / SadTalker / LivePortrait**
  (free, self-hosted, GPU) → produce a different `avatar.mp4` from a real anchor photo + TTS.
  Nothing else in the pipeline changes.

---

## Worked examples

**Daily News (today):** production `daily-news` × theme `newshound` (or `newshound-fb`) ×
talent `pytoon`. Spunky cartoon, James voice, 5 stories.

**"World Brief" (a future, serious variant):** new production `world-brief` × a new sober
theme `broadcast` × talent `realistic` (D-ID anchor). Same engine, totally different show
— different brand, voice, look, and a *real* anchor face — by adding one production.json,
one theme folder, and pointing the overlay step at D-ID.

**India News (Hindi):** production `india-news` × theme `newshound` × talent `pytoon`,
with a Hindi `voice` and the n8n script prompts in Hindi. (Already a real n8n workflow.)

---

## Make a new… (cheat-sheet)

- **New look only** → add `remotion/src/themes/<theme>/` (the 4 scenes + palette), register
  its compositions in `Root.tsx`, teach `build_background.js` the theme→composition map,
  set `production.json` `"theme"`.
- **New show** → copy `productions/daily-news/` → `productions/<id>/`, edit `production.json`
  (brand, voice, theme, scene order). (Production-folder selection is currently hard-coded
  to `daily-news`; we'll make it a dispatch input when wiring the n8n `template` param.)
- **New face (realistic anchor)** → swap the overlay producer (the step that makes
  `avatar.mp4`) for D-ID/MuseTalk; keep everything else.

See also: `productions/daily-news/TEMPLATE.md` (the technical template),
`News_Programs/James_Newshound/` (brand soul), `CLAUDE.md` (pipeline).
