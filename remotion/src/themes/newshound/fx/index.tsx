import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { NH } from '../../newshound';

// Transparent overlay FX for the image zone. Each is a thin "broadcast texture"
// layer. Picked per story (deterministic by index) so it varies shot to shot.
// All are subtle — they add life without fighting the photo.

// 1) SCANLINE — a bright line sweeping down the frame (the old "TV line").
export const Scanline: React.FC = () => {
  const frame = useCurrentFrame();
  const y = (frame * 2.2) % 110 - 5; // %; loops top→bottom
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, height: 4, background: `linear-gradient(90deg, transparent, ${NH.cyan}, transparent)`, opacity: 0.5, boxShadow: `0 0 24px ${NH.cyan}` }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: `${y}%`, height: 80, transform: 'translateY(-80px)', background: `linear-gradient(0deg, rgba(25,195,230,0.12), transparent)` }} />
    </AbsoluteFill>
  );
};

// 2) MESH — a faint grid at ~16% opacity, slowly drifting.
export const Mesh: React.FC = () => {
  const frame = useCurrentFrame();
  const o = (frame * 0.4) % 48;
  return (
    <AbsoluteFill style={{
      pointerEvents: 'none', opacity: 0.16,
      backgroundImage: `linear-gradient(${NH.cyan} 1px, transparent 1px), linear-gradient(90deg, ${NH.cyan} 1px, transparent 1px)`,
      backgroundSize: '48px 48px', backgroundPosition: `${o}px ${o}px`,
    }} />
  );
};

// 3) CRT — fine horizontal scanlines + a slow flicker (retro broadcast).
export const CRT: React.FC = () => {
  const frame = useCurrentFrame();
  const flick = 0.10 + 0.05 * Math.sin(frame / 3);
  return (
    <AbsoluteFill style={{
      pointerEvents: 'none', opacity: flick,
      backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.6) 0px, rgba(0,0,0,0.6) 2px, transparent 2px, transparent 4px)',
    }} />
  );
};

// 4) LIGHTSWEEP — a diagonal glare passing across, like a studio light.
export const LightSweep: React.FC = () => {
  const frame = useCurrentFrame();
  const x = ((frame * 1.6) % 160) - 30; // %
  return (
    <AbsoluteFill style={{ overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: '-30%', bottom: '-30%', left: `${x}%`, width: 240, transform: 'rotate(14deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
    </AbsoluteFill>
  );
};

// 5) DOTS — a faint halftone dot grid (print/news texture).
export const Dots: React.FC = () => (
  <AbsoluteFill style={{
    pointerEvents: 'none', opacity: 0.14,
    backgroundImage: `radial-gradient(${NH.white} 1.5px, transparent 1.6px)`,
    backgroundSize: '26px 26px',
  }} />
);

export const FX = { scanline: Scanline, mesh: Mesh, crt: CRT, lightsweep: LightSweep, dots: Dots };
export type FxName = keyof typeof FX;
const ORDER: FxName[] = ['scanline', 'mesh', 'crt', 'lightsweep', 'dots'];

// Deterministic pick per story so it varies but is reproducible.
export const StoryFX: React.FC<{ seed?: number }> = ({ seed = 0 }) => {
  const Comp = FX[ORDER[seed % ORDER.length]];
  return <Comp />;
};

// Standalone preview: the FX over a sample news photo (so you can see each one).
export const FxDemo: React.FC<{ fx: FxName }> = ({ fx }) => {
  const Comp = FX[fx];
  return (
    <AbsoluteFill style={{ background: NH.charcoal }}>
      <Img src={staticFile('images/0.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <Comp />
    </AbsoluteFill>
  );
};
