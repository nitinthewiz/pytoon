// MarketTicker — markets / multiple moving values (MOTION_GRAPHICS_SPEC §MarketTicker).
// A charcoal (bg) strip whose up/down rows scroll horizontally like the Furniture marquee,
// over a spark line that draws L→R via stroke-dashoffset. The scroll is CONTINUOUS (it is
// the IDLE behaviour itself — it never settles). Theme-agnostic: ALL colours/fonts/motion
// come from useTheme(); imports NO NH/ANTON/INTER. Renders inside <GraphicShell>. Authors
// the IN/BUILD/IDLE envelope only — NO exit (the TransitionSeries owns the out).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import type { MarketTickerData } from './types';

const STRIP_W = 980;
const SPARK_W = 980;
const SPARK_H = 220;

export const MarketTicker: React.FC<MarketTickerData> = ({ rows, headline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  const up = (pct: number) => pct >= 0;
  const toneFor = (pct: number) => (up(pct) ? t.palette.accent : t.palette.alert);

  // IN: spring slam of the strip.
  const pop = spring({ frame: frame - 2, fps, config: { damping: 13, mass: 0.6, stiffness: 160 } });
  const popScale = interpolate(pop, [0, 1], [0.78, 1]);

  // IDLE (continuous): the marquee scrolls forever, mirroring Furniture.Ticker's math.
  // Doubled content + a modulo wrap keeps it seamless at any slot length.
  const scroll = -((frame * 3.6) % STRIP_W);

  // One scrollable row chip: symbol, value, signed % with an up/down chevron.
  const RowChip: React.FC<{ symbol: string; value: string; changePct: number }> = ({
    symbol,
    value,
    changePct,
  }) => {
    const tone = toneFor(changePct);
    const sign = changePct >= 0 ? '+' : '';
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 36px',
          height: '100%',
        }}
      >
        <span
          style={{
            fontFamily: t.fonts.display,
            fontWeight: t.fonts.displayWeight,
            fontSize: 40,
            letterSpacing: 1,
            color: t.palette.fg,
          }}
        >
          {symbol}
        </span>
        <span style={{ fontFamily: t.fonts.body, fontWeight: 800, fontSize: 36, color: t.palette.fg }}>
          {value}
        </span>
        {/* chevron: ▲ up / ▼ down, tinted accent/alert */}
        <span style={{ fontSize: 30, color: tone, lineHeight: 1 }}>
          {up(changePct) ? '▲' : '▼'}
        </span>
        <span style={{ fontFamily: t.fonts.body, fontWeight: 900, fontSize: 36, color: tone }}>
          {sign}
          {changePct.toFixed(2)}%
        </span>
      </div>
    );
  };

  // The marquee content, doubled so the modulo wrap is seamless.
  const Strip: React.FC = () => (
    <>
      {rows.map((r, i) => (
        <RowChip key={`a${i}`} symbol={r.symbol} value={r.value} changePct={r.changePct} />
      ))}
      {rows.map((r, i) => (
        <RowChip key={`b${i}`} symbol={r.symbol} value={r.value} changePct={r.changePct} />
      ))}
    </>
  );

  // The spark line: a smooth path built from the rows' changePct, normalised into the box.
  // It DRAWS L→R during BUILD via stroke-dashoffset, then holds.
  const max = Math.max(...rows.map((r) => Math.abs(r.changePct)), 1);
  const pts = rows.map((r, i) => {
    const x = rows.length > 1 ? (i / (rows.length - 1)) * SPARK_W : SPARK_W / 2;
    // higher changePct → higher on the chart (smaller y); centre at mid.
    const y = SPARK_H / 2 - (r.changePct / max) * (SPARK_H / 2 - 16);
    return { x, y };
  });
  const sparkPath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // Net direction tints the spark (last vs first).
  const net = rows.length ? rows[rows.length - 1].changePct - rows[0].changePct : 0;
  const sparkTone = toneFor(net);
  // The dash length is an over-estimate of the polyline length (always ≥ true length),
  // so the L→R draw fully completes; dashoffset goes len→0 over BUILD.
  const dashLen = SPARK_W + SPARK_H + 200;
  const draw = interpolate(frame, [8, 38], [dashLen, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <GraphicShell wire={false}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 30,
          transform: `scale(${popScale})`,
        }}
      >
        {headline && (
          <div
            style={{
              fontFamily: t.fonts.display,
              fontWeight: t.fonts.displayWeight,
              fontSize: 64,
              letterSpacing: 2,
              color: t.palette.hero,
              WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
              textTransform: 'uppercase',
              opacity: buildReveal(frame, 4, 12),
            }}
          >
            {headline}
          </div>
        )}

        {/* Spark line — draws L→R via stroke-dashoffset. */}
        <svg
          width={SPARK_W}
          height={SPARK_H}
          viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          style={{ overflow: 'visible' }}
        >
          {/* baseline at the mid-line */}
          <line
            x1={0}
            y1={SPARK_H / 2}
            x2={SPARK_W}
            y2={SPARK_H / 2}
            stroke="rgba(255,255,255,0.12)"
            strokeWidth={2}
          />
          <path
            d={sparkPath}
            fill="none"
            stroke={sparkTone}
            strokeWidth={6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashLen}
            strokeDashoffset={draw}
            style={{ filter: `drop-shadow(0 0 10px ${sparkTone})` }}
          />
        </svg>

        {/* The scrolling charcoal strip — continuous marquee, doubled content for seamless wrap. */}
        <div
          style={{
            width: STRIP_W,
            height: 96,
            background: t.palette.bg,
            borderRadius: t.motion.cornerRadius,
            border: `3px solid ${t.palette.hero}`,
            overflow: 'hidden',
            position: 'relative',
            opacity: buildReveal(frame, 10, 12),
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              transform: `translateX(${scroll}px)`,
            }}
          >
            <Strip />
            <Strip />
          </div>
        </div>
      </div>
    </GraphicShell>
  );
};
