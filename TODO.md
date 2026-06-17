- [ ] Review and scale font sizes/paddings in Remotion components (CaptionsOverlay, StorySlide, TeaserSlide) to match new 1792x2688 resolution.
- [ ] **Platform UI safe zones (from BRANDING_STRATEGY.md §3).** Verify the lower-third
  `take` chyron + category badge + ticker + story-progress pips sit inside the *intersection*
  of TikTok / Instagram Reels / YouTube Shorts safe areas — NOT just the generic top-10% /
  bottom-14% margin. Each app overlays a **right-side action rail** (like/comment/share) and
  a **bottom-left caption + handle** block that can cover ~20–25% of the bottom and the right
  edge. Map each platform's actual overlay, then raise/inset the furniture so nothing
  important is occluded on any of the three; verify against a real render. Chyron + furniture
  live in `remotion/src/themes/newshound/Story` + `Furniture.tsx`; geometry in `layout.ts`.
  Spec: `../News_Programs/James_Newshound/personality.md` §8.