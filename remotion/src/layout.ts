// Single source of truth for all pixel positions.
// Derived from ToonVertical2.svg (1080 × 2355 canvas).

export const CANVAS_W = 1080;
export const CANVAS_H = 2355;

// Avatar zone — studio BG + talking head occupy the top
export const AVATAR_ZONE_H = 782;

// Lower-third badges sit at the bottom of the avatar zone
export const BADGE_Y = 737;
export const BADGE_H = 70;

// Green accent bar separates headline from news image
export const GREEN_BAR_Y = 883;
export const GREEN_BAR_H = 113;   // y 883–996

// White headline card sits over the green bar.
// Left (x 0–27) and right (x 1018–1080) strips of the bar remain visible.
export const HEADLINE_CARD_X = 27;
export const HEADLINE_CARD_Y = 791;
export const HEADLINE_CARD_W = 991;
export const HEADLINE_CARD_H = 279; // y 791–1070
export const HEADLINE_Y = 800;      // text top within the card

// News image zone
export const IMAGE_Y = 985;

// Captions — TikTok-style, overlaid in the image zone
export const CAPTION_TOP = 1940;

// Brand colours
export const GREEN = '#219653';
export const BADGE_BG = '#EBEBEB';

// Transition lengths
export const TRANSITION_FRAMES = 15;
export const TEASER_TRANSITION_FRAMES = 8; // snappier cuts for the intro teaser
