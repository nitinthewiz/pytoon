# Dynamic Background Video Plan

## What we're building
Replace the static `background_video.mp4` with a dynamically generated one that shows news images (from the MediaStack API) in the top half of the frame, synced approximately to the spoken audio. The pytoon avatar occupies the bottom half and is overlaid on top by `main.py`.

## Video dimensions
- Canvas: 1792 × 2688 (portrait)
- Image zone (top): 1792 × 1344px (y 0–1344)
- Avatar zone (bottom): 1792 × 1344px (y 1344–2688) — pytoon anchors here

## Architecture

### 1. n8n workflow changes

Make these 6 targeted changes in the n8n UI for the **MediaStack2Telegram** workflow.

---

**Change 1 — Add "Filter Images" Code node**

Insert a new Code node between `HTTP Request1` and `Build DeepInfra Request`.
- Connect: `HTTP Request1` → `Filter Images` → `Build DeepInfra Request`
- Node type: Code
- Name: `Filter Images`
- Language: JavaScript
- Code:
```javascript
const data = $input.first().json.data || [];
const filtered = data
  .filter(item => item.image !== null && item.image !== undefined)
  .map(({ title, description, url, image, category }) => ({ title, description, url, image, category }));
const newsB64 = Buffer.from(JSON.stringify(filtered)).toString('base64');
return [{ json: { newsB64, filteredData: filtered } }];
```

---

**Change 2 — Update "Build DeepInfra Request" Code node**

In the existing `Build DeepInfra Request` node, replace the user message content line:
```javascript
// BEFORE
{ role: 'user', content: JSON.stringify($input.all()) }
// AFTER
{ role: 'user', content: JSON.stringify($input.first().json.filteredData) }
```

---

**Change 3 — Update "Basic LLM Chain3" prompt**

Add two lines to the prompt, just before "Topics -":
```
For each individual news story you mention, start a new line with [ITEM] immediately before that story's sentence.
Mention stories in the order they appear in the topics below.
```

---

**Change 4 — Add "Process Speech" Code node**

Insert a new Code node between `Basic LLM Chain3` and `Passing variables`.
- Connect: `Basic LLM Chain3` → `Process Speech` → `Passing variables`
- Node type: Code
- Name: `Process Speech`
- Language: JavaScript
- Code:
```javascript
const text = $input.first().json.text;
const cleanText = text.replace(/\[ITEM\]\n?/g, '').trim();
const speechB64 = Buffer.from(text).toString('base64');
return [{ json: { cleanText, speechB64 } }];
```

---

**Change 5 — Update "Passing variables" Set node**

In the `Passing variables` Set node, the `input` field currently references `$json.text`. Update it to reference `$json.cleanText`:
```
{{ $json.cleanText.replace(/"/g, '\\"').replace(/\n/g, ' ') }}
```

---

**Change 6 — Update "Dispatch a workflow event" GitHub node**

In the `inputs` field of the GitHub dispatch node, add two new keys:
```json
{
  "audio_input": "{{ $today.format('yyyy-MM-dd')}}-{{$execution.id }}.mp3",
  "news_b64": "={{ $('Filter Images').item.json.newsB64 }}",
  "speech_b64": "={{ $('Process Speech').item.json.speechB64 }}"
}
```

### 2. GitHub workflow changes (main.yml)
- Add `news_b64` and `speech_b64` as `workflow_dispatch` inputs.
- Add PowerShell steps to base64-decode both inputs to `news.json` and `speech.txt`.
- Add `actions/setup-node@v4` (Node 20).
- Add `npm install` step in `remotion/` directory.
- Add `node build_background.js` step (skipped if `news_b64` is empty).
- Fallback: if the build step is skipped or produces no output, `main.py` uses the existing checked-in `background_video.mp4`.

### 3. New files in repo
- `build_background.js` — orchestration: reads inputs, downloads images, calls Remotion render.
- `remotion/` — Remotion project for generating the background video.
  - `package.json`
  - `tsconfig.json`
  - `remotion.config.ts`
  - `src/index.tsx` — Remotion entry point
  - `src/Root.tsx` — composition registration with `calculateMetadata`
  - `src/NewsSlideshow.tsx` — the actual video composition
  - `src/transitions.ts` — **edit this file to change transition animations**

## Alignment approach (Option A — chosen)
The speech text is generated from TTS (Kokoro), which has very consistent pacing (~2.5–3 words/sec). We use proportional word-count timing:
1. Split speech text by `[ITEM]` delimiters → N segments.
2. Count words per segment.
3. `segmentFrames[i] = (wordCount[i] / totalWords) * totalAudioFrames`
4. Map segment i → news item i's image.

This gives approximate but visually convincing sync. Works well because TTS pace is uniform.

## Option B — future upgrade if Option A drifts
Use structured JSON output from the LLM instead of delimited plain text.

Change `Basic LLM Chain3` to output JSON:
```json
{
  "speech": "Good afternoon, I'm James Newshound...",
  "items": [
    { "text": "In sports, NBA tensions as Dillon Brooks...", "storyIndex": 0 },
    { "text": "Australian Open final...", "storyIndex": 1 }
  ]
}
```
- `speech` field → TTS (clean, no post-processing needed)
- `items` array → timing computation (word counts + story index mapping)
- More robust: no regex stripping needed, explicit story-to-image mapping

Switch to Option B if `[ITEM]` delimiters appear in the audio output, if the LLM stops inserting them reliably, or if timing drift becomes noticeable.

## Fallback behavior
If `news_b64` is empty (n8n didn't pass it), the build step is skipped entirely. `main.py` uses the existing `background_video.mp4` checked into the repo. No wasted processing.

## Future improvements
- Remotion: add news headline text overlay on each image (title of the story).
- Remotion: add category badge (sports, tech, etc.) in a corner.
- Expression/emotion control in pytoon (separate task — see pytoon library's emotion support).
- More precise timing via Kokoro word timestamps if the API exposes them.
- Filter low-resolution images (e.g. skip images smaller than 400px wide).
