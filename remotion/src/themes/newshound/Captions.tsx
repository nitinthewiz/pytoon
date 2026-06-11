import React, { useMemo } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { createTikTokStyleCaptions } from '@remotion/captions';
import { INTER } from '../../fonts';
import { NH } from '../newshound';
import { CAPTION_TOP } from '../../layout';
import { type CompositionProps } from '../../types';

// Green-screen caption track (composited via colorkey). Inter heavy pop-ons,
// active word in Newshound Yellow, thick ink outline.
export const NewshoundCaptions: React.FC<CompositionProps & { captionTop?: number }> = ({ captions, captionTop }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = (frame / fps) * 1000;
  const top = captionTop ?? CAPTION_TOP;

  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions: captions ?? [], combineTokensWithinMilliseconds: 1100 }),
    [captions],
  );
  const activePage = pages.findLast((p) => p.startMs <= timeMs) ?? null;

  return (
    <AbsoluteFill style={{ backgroundColor: '#00FF00' }}>
      {activePage && (
        <div style={{ position: 'absolute', top, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 56px' }}>
          {/* NOTE: no translucent backing — it would survive the green-key as a tinted
              box. Readability comes from the thick paint-order ink outline + the
              opaque yellow chip on the active word. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '8px 16px', maxWidth: 940 }}>
            {activePage.tokens.map((token, i) => {
              const isActive = timeMs >= token.fromMs && timeMs <= token.toMs;
              return (
                <span
                  key={i}
                  style={{
                    fontFamily: INTER,
                    fontWeight: 800,
                    fontSize: 76,
                    lineHeight: 1.1,
                    color: isActive ? NH.ink : NH.white,
                    // clean thick outline drawn BEHIND the fill (paint-order) — no patchy multi-shadow
                    WebkitTextStroke: isActive ? '0' : `9px ${NH.ink}`,
                    paintOrder: 'stroke fill',
                    textShadow: '0 4px 10px rgba(0,0,0,0.55)',
                    textTransform: 'uppercase',
                    whiteSpace: 'pre',
                    // active word: solid yellow chip (high-contrast, very readable)
                    background: isActive ? NH.yellow : 'transparent',
                    borderRadius: isActive ? 10 : 0,
                    padding: isActive ? '0 12px' : '0',
                    transform: isActive ? 'translateY(-2px)' : 'none',
                  }}
                >
                  {token.text.trim()}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
