import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import {
  IMAGE_Y,
  GREEN_BAR_Y, GREEN_BAR_H,
  HEADLINE_CARD_X, HEADLINE_CARD_Y, HEADLINE_CARD_W, HEADLINE_CARD_H,
  GREEN,
  TEASER_TRANSITION_FRAMES,
} from './layout';
import { ROBOTO } from './fonts';

type Props = {
  images: string[];
  durationInFrames: number;
};

export const TeaserSlide: React.FC<Props> = ({ images, durationInFrames }) => {
  if (images.length === 0) {
    return <AbsoluteFill style={{ backgroundColor: '#1a1a2e' }} />;
  }

  const n = images.length;
  const totalSequenceFrames = durationInFrames + (n - 1) * TEASER_TRANSITION_FRAMES;
  const baseFrames = Math.floor(totalSequenceFrames / n);
  const remainder = totalSequenceFrames - baseFrames * n;
  const frameCounts = images.map((_, i) =>
    i === n - 1 ? baseFrames + remainder : baseFrames
  );

  return (
    <AbsoluteFill>

      {/* Teaser images cycle in the news-image zone */}
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
        <TransitionSeries>
          {images.map((imgPath, i) => (
            <React.Fragment key={i}>
              <TransitionSeries.Sequence durationInFrames={frameCounts[i]}>
                <AbsoluteFill>
                  <Img
                    src={staticFile(imgPath)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </AbsoluteFill>
              </TransitionSeries.Sequence>
              {i < n - 1 && (
                <TransitionSeries.Transition
                  timing={linearTiming({ durationInFrames: TEASER_TRANSITION_FRAMES })}
                  presentation={fade()}
                />
              )}
            </React.Fragment>
          ))}
        </TransitionSeries>
      </div>

      {/* Green accent bar */}
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

      {/* White headline card with centred label */}
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
            color: GREEN,
            lineHeight: 1.16,
            textTransform: 'uppercase',
          }}
        >
          TONIGHT'S TOP STORIES
        </span>
      </div>

    </AbsoluteFill>
  );
};
