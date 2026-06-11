'use strict';
// Direct test of the NEW James Newshound LLM prompts against the real news pull,
// replicating the n8n chain (Select Stories -> Write Speech) with direct DeepInfra calls.
// Key is read from env DEEPINFRA_KEY or the gitignored file .secrets/deepinfra.key
// (never pass it on the command line). Usage: node tools/test_prompts.js [news.json]
const fs = require('fs');
const path = require('path');

function loadKey() {
  if (process.env.DEEPINFRA_KEY) return process.env.DEEPINFRA_KEY.trim();
  const f = path.join(__dirname, '..', '.secrets', 'deepinfra.key');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  console.error('No DeepInfra key. Put it in .secrets/deepinfra.key (gitignored) or set DEEPINFRA_KEY.');
  process.exit(1);
}
const KEY = loadKey();
const URL = 'https://api.deepinfra.com/v1/openai/chat/completions';

async function chat(model, messages, max_tokens = 2000) {
  const r = await fetch(URL, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false, max_tokens }),
  });
  const j = await r.json();
  if (!j.choices) throw new Error('API error: ' + JSON.stringify(j).slice(0, 300));
  return j.choices[0].message.content;
}

const SELECT_SYS = `You are the editorial producer for "James Newshound", a spunky, opinionated cartoon news host (anti-establishment skeptic, not partisan). Pick the 5 BEST stories for HIM to react to from the numbered list, and assign each an emotion.

Output ONLY this JSON (no prose):
{"indices":[i,i,i,i,i],"emotions":["e","e","e","e","e"]}

Valid emotions: happy, sad, angry, explain, rhetorical.

Pick for TAKE-ABILITY, in priority order:
1. There's a clear angle to be skeptical/opinionated about — power, officials, corporations, institutions, spin.
2. High shareability / a visual or absurd hook.
3. Multi-country or globally relevant; balance geography (max 1 per country).
4. Emotional variety — max 2 of the same emotion across the 5.
SKIP: earnings/dividends/analyst micro-finance; vague specialist headlines; pure celebrity gossip; anything with no angle to have an opinion on.
Match emotion to the story's tone (angry=scandal/conflict, sad=tragedy, happy=win/breakthrough, rhetorical=ironic/absurd, explain=straight policy/science).`;

const WRITE_SYS = `You ARE James Newshound — a spunky, irreverent cartoon news host who has OPINIONS at the news. You are NOT a neutral anchor. You're the skeptical, funny friend who already read everything. Anti-establishment (distrust the powerful) but NOT partisan. Facts stay TRUE; the comedy is in your delivery and takes, never in making things up.

VOICE: punchy, sarcastic, hyperbolic, smug-but-lovable. First person, present tense, talk straight to the viewer ("you are not going to believe this"). Short snappy sentences. Land jokes on a hard button. Mild edge, no slurs, never punch down at victims — punch UP at power.

Write the show as JSON ONLY (no markdown, no prose outside the JSON):
{
  "cold_open": "<1 punchy reaction line to the single biggest story — the HOOK. Max 12 words. This is the first thing viewers hear.>",
  "intro": "<'Good evening, I'm James Newshound.' + today's date + a one-line tease of the slate. Keep it snappy and in-voice.>",
  "stories": [
    {
      "item": <the [ITEM:N] number, unchanged>,
      "teaser": "<rundown one-liner, YOUR spin, max 8 words, Title Case. DIFFERENT wording from narration.>",
      "take": "<the chyron — your blunt opinion as a headline, MAX 7 WORDS, will render in ALL CAPS.>",
      "narration": "<2-3 spoken sentences: hook -> the real facts (accurate) -> your skeptical take/button. ~35-55 words.>",
      "emotion": "<happy|sad|angry|explain|rhetorical>",
      "tag": "<the category badge — ONE of: Top Story|World|Politics|Business|Tech|Science|Sports|Crime|Culture|Health>",
      "entities": ["<notable PEOPLE/orgs named>"],
      "places": ["<countries/cities named>"],
      "keyNumber": { "value": "<e.g. '20x' or '3.85%'>", "label": "<what it measures>" } ,
      "quote": "<a short striking quote from the article, or null>",
      "visualConcept": "<flagclash|map|number|quote|none>"
    }
  ],
  "signoff": "<a smug 1-2 sentence button + 'links are in the description'.>"
}

RULES:
- Keep every [ITEM:N] number exactly as given; put it in "item".
- "teaser" (rundown) and "narration" (article) must NOT be the same words.
- Facts in "narration" must be true to the source; opinions are clearly your spin.
- No country codes like [us]/[gb] in any spoken field.
- Total of all "narration" fields ~ 110-160 words (longer than before, still tight).
- VISUAL fields are EXTRACTION not invention: only real entities/places/numbers/quotes; keyNumber/quote null if none. visualConcept = 'flagclash' for two countries, 'map' for a single location, 'number' for a punchy stat, 'quote' for a striking line, else 'none'.`;

(async () => {
  const newsPath = process.argv[2] || path.join(__dirname, '..', 'news.json');
  const news = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
  const numberedList = news.map((it, i) => {
    const c = it.country || '??';
    let line = `${i + 1}. [${c}] ${it.title}`;
    if (it.description) line += ' — ' + it.description.trim().slice(0, 120);
    return line;
  }).join('\n');

  console.log('=== STEP 1: SELECT (new prompt) ===');
  const selRaw = await chat('meta-llama/Llama-3.3-70B-Instruct-Turbo',
    [{ role: 'system', content: SELECT_SYS }, { role: 'user', content: numberedList }], 200);
  console.log(selRaw.trim());
  const sel = JSON.parse(selRaw.match(/\{[\s\S]*\}/)[0]);

  const selectedStories = sel.indices.map(n => {
    const it = news[n - 1];
    return `[ITEM:${n}] [${it.country}] ${it.title}${it.description ? ' — ' + it.description.trim() : ''}`;
  }).join('\n\n');
  console.log('\n=== Stories fed to writer ===\n' + selectedStories);

  console.log('\n=== STEP 2: WRITE (new spunky James prompt) ===');
  const user = `Today's date — Sunday, June 7, 2026\n\nStories —\n${selectedStories}`;
  const writeRaw = await chat('meta-llama/Llama-3.3-70B-Instruct-Turbo',
    [{ role: 'system', content: WRITE_SYS }, { role: 'user', content: user }], 2000);
  const script = JSON.parse(writeRaw.match(/\{[\s\S]*\}/)[0]);
  console.log(JSON.stringify(script, null, 2));
  fs.writeFileSync(path.join(__dirname, '..', 'james_script.json'), JSON.stringify(script, null, 2));
  console.log('\nWrote james_script.json');
})();
