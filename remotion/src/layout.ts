// Single source of truth for all pixel positions.
// Canvas: 1080 × 1920 (9:16 portrait) — rescaled from ToonVertical2.svg (1080 × 2355).

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;

// Avatar zone — studio BG + talking head occupy the top
export const AVATAR_ZONE_H = 640;

// Lower-third badges sit near the bottom of the avatar zone
export const BADGE_Y = 600;
export const BADGE_H = 57;

// Green accent bar separates headline card from news image
export const GREEN_BAR_Y = 718;
export const GREEN_BAR_H = 92; // y 718–810

// White headline card floats over the green bar.
// Left (x 0–27) and right (x 1018–1080) strips of the bar remain visible.
export const HEADLINE_CARD_X = 27;
export const HEADLINE_CARD_Y = 645;
export const HEADLINE_CARD_W = 991;
export const HEADLINE_CARD_H = 228; // y 645–873

// News image zone — image is behind the card; only visible below card bottom (873)
export const IMAGE_Y = 803;

// Captions — TikTok-style overlay in the lower image zone, above the bottom bar
export const CAPTION_TOP = 1480;

// Bottom ticker bar
export const BOTTOM_BAR_H = 72;

// Brand colours
export const GREEN = '#219653';
export const BADGE_BG = '#EBEBEB';

// Transition lengths
export const TRANSITION_FRAMES = 15;
export const TEASER_TRANSITION_FRAMES = 8;
