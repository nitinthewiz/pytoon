// Single source of truth for all pixel positions.
// Canvas: 1080 × 1920 (Portrait 9:16 — TikTok / Reels / YouTube Shorts standard)

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

// Avatar zone — studio BG + talking head occupy the top.
// main.py overlays the pytoon avatar over this region; keep AVATAR_ZONE_H in
// sync with main.py's avatar_crop_height so the composite lines up.
export const AVATAR_ZONE_H = 704;

// "Top News" badge + source badge sit on one row at the bottom of the avatar zone
export const BADGE_Y = 608;
export const BADGE_H = 96;

// Green accent bar — full width behind the headline card; peeks at the card's
// left/right margins
export const GREEN_BAR_Y = 784;
export const GREEN_BAR_H = 100; // y 784–884

// White headline card floats over the green bar (40px margins each side)
export const HEADLINE_CARD_X = 40;
export const HEADLINE_CARD_Y = 704;
export const HEADLINE_CARD_W = 1000; // 1080 - (40 * 2)
export const HEADLINE_CARD_H = 250;  // y 704–954

// News image zone — image is behind the card; only fully visible below card bottom
export const IMAGE_Y = 876;

// Captions — TikTok-style overlay over the avatar's lower third
export const CAPTION_TOP = 1500;

// Bottom ticker bar
export const BOTTOM_BAR_H = 72;

// Brand colours
export const GREEN = '#219653';
export const BADGE_BG = '#EBEBEB';

// Transition lengths
export const TRANSITION_FRAMES = 15;
export const TEASER_TRANSITION_FRAMES = 8;
