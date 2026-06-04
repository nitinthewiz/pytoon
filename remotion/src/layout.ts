// Single source of truth for all pixel positions.
// Canvas: 1792 × 2688 (Portrait)

export const CANVAS_W = 1792;
export const CANVAS_H = 2688;

// Avatar zone — studio BG + talking head occupy the top
export const AVATAR_ZONE_H = 896;

// Lower-third badges sit near the bottom of the avatar zone
export const BADGE_Y = 840;
export const BADGE_H = 80;

// Green accent bar separates headline card from news image
export const GREEN_BAR_Y = 1005;
export const GREEN_BAR_H = 130; // y 1005–1135

// White headline card floats over the green bar.
// Perfectly symmetrical margins (46px on each side)
export const HEADLINE_CARD_X = 46;
export const HEADLINE_CARD_Y = 903;
export const HEADLINE_CARD_W = 1700; // 1792 - (46 * 2)
export const HEADLINE_CARD_H = 320;  // y 903–1223

// News image zone — image is behind the card; only visible below card bottom
export const IMAGE_Y = 1125;

// Captions — TikTok-style overlay in lower image zone
export const CAPTION_TOP = 2072;

// Bottom ticker bar
export const BOTTOM_BAR_H = 100;

// Brand colours
export const GREEN = '#219653';
export const BADGE_BG = '#EBEBEB';

// Transition lengths
export const TRANSITION_FRAMES = 15;
export const TEASER_TRANSITION_FRAMES = 8;
