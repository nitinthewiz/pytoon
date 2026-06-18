// GraphicShell — the shared themed wrapper every graphic block renders inside
// (visual-component-library §2.5, MOTION_GRAPHICS_SPEC §motion build-order 3).
//
// Gives every primitive, for free and on-brand in ANY theme:
//   • a themed radial background (bg2 → bg)
//   • a faint themed WireField (scrolling broadcast wire-feed lines)
//   • an IN white-flash at the cut (the "slam")
//   • the IN/BUILD/IDLE envelope — re-exported helper hooks so blocks don't reimplement.
//
// THEME-AGNOSTIC by construction: all colours/fonts come from useTheme(); it imports no
// NH/ANTON/INTER. A block NEVER authors an exit animation — the TransitionSeries owns the
// out (slot length is variable). Pure CSS transform/opacity/filter — headless-safe.
import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { useTheme } from '../theme/ThemeContext';
import { inFlash, buildReveal, idleOsc } from './motion';

// Re-export the envelope helpers so a block imports them straight from the shell.
export { inFlash, buildReveal, idleOsc } from './motion';

// Themed faint wire-feed lines — a brand-agnostic clone of Furniture.WireField that reads
// its accent from the theme instead of NH.cyan.
export const WireField: React.FC = () => {
  const frame = useCurrentFrame();
  const t = useTheme();
  return (
    <AbsoluteFill style={{ overflow: 'hidden', opacity: 0.5 }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const y = (i / 14) * 1920;
        const shift = (frame * (i % 2 ? 1.2 : -1.2)) % 400;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: y,
              left: -200,
              right: -200,
              height: 2,
              background: i % 4 === 0 ? t.palette.accent : 'rgba(255,255,255,0.12)',
              transform: `translateX(${shift}px)`,
              opacity: i % 4 === 0 ? 0.5 : 0.25,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

type ShellProps = {
  children: React.ReactNode;
  // turn the wire-feed lines off for dense data blocks where they'd add noise
  wire?: boolean;
  // turn the IN white-flash off (e.g. a block that owns its own flash, like VS)
  flash?: boolean;
  // override the content layout (defaults to centred column)
  align?: 'center' | 'stretch';
};

export const GraphicShell: React.FC<ShellProps> = ({
  children,
  wire = true,
  flash = true,
  align = 'center',
}) => {
  const frame = useCurrentFrame();
  const t = useTheme();
  const flashOpacity = flash ? inFlash(frame) : 0;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, ${t.palette.bg2} 0%, ${t.palette.bg} 75%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'stretch',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {wire && <WireField />}
      {children}
      {flash && (
        <AbsoluteFill
          style={{ background: t.palette.fg, opacity: flashOpacity, pointerEvents: 'none' }}
        />
      )}
    </AbsoluteFill>
  );
};
