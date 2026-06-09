import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import {
  GREEN_BAR_Y, GREEN_BAR_H,
  HEADLINE_CARD_X, HEADLINE_CARD_Y, HEADLINE_CARD_W, HEADLINE_CARD_H,
  IMAGE_Y,
  BADGE_Y, BADGE_H,
  GREEN, BADGE_BG,
} from './layout';
import { ROBOTO } from './fonts';
import { type NewsItem } from './types';

type Props = { item: NewsItem };

export const StorySlide: React.FC<Props> = ({ item }) => (
  <AbsoluteFill>

    {/* 1. News image (lowest layer) */}
    <div
      style={{
        position: 'absolute',
        top: IMAGE_Y,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
      }}
    >
      {item.imagePath ? (
        <Img
          src={staticFile(item.imagePath)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#1a1a2e' }} />
      )}
    </div>

    {/* 2. Green accent bar — on top of image */}
    <div
      style={{
        position: 'absolute',
        top: GREEN_BAR_Y,
        left: 0,
        width: '100%',
        height: GREEN_BAR_H,
        backgroundColor: GREEN,
      }}
    />

    {/* 3 + 4. White headline card with vertically centred text */}
    <div
      style={{
        position: 'absolute',
        top: HEADLINE_CARD_Y,
        left: HEADLINE_CARD_X,
        width: HEADLINE_CARD_W,
        height: HEADLINE_CARD_H,
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        padding: '0 36px',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          fontFamily: ROBOTO,
          fontSize: 62,
          fontWeight: 700,
          color: '#111111',
          lineHeight: 1.16,
          textTransform: 'uppercase',
        }}
      >
        {item.title ?? ''}
      </span>
    </div>

    {/* 5. Source / category badge — top-right of avatar zone */}
    {item.source ? (
      <div
        style={{
          position: 'absolute',
          top: BADGE_Y,
          right: 40,
          minWidth: 200,
          height: BADGE_H,
          padding: '0 28px',
          boxSizing: 'border-box',
          backgroundColor: BADGE_BG,
          borderRadius: 4,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: ROBOTO,
            fontSize: 34,
            fontWeight: 500,
            color: '#333333',
          }}
        >
          {item.source}
        </span>
      </div>
    ) : null}

  </AbsoluteFill>
);
