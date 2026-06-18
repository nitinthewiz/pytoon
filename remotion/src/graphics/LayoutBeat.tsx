// LayoutBeat — the SAFE self-generating primitive (MOTION_GRAPHICS_SPEC §self-generating
// (2): {type:'layout'; spec:LayoutSpec}).
//
// A LayoutSpec is a FLAT node list. Each node maps to ONE absolutely-positioned, themed
// div / <Img>, driven by useCurrentFrame(). This is "generation on the fly" with ZERO
// code execution: NO eval, NO innerHTML/dangerouslySetInnerHTML, NO dynamic import, NO
// codegen. The anim enum reuses the same IN/BUILD/IDLE envelope helpers every hand-built
// block uses (motion.ts), so generated beats move for free and headless-safe (pure CSS
// transform/opacity/filter + interpolate()/spring()).
//
// DEFENCE IN DEPTH (both PURE DATA — render can never break):
//   • zod-validate the whole spec (LayoutSpecSchema). Invalid → a themed <FallbackCard>.
//   • a per-node runtime guard clamps x/y/w/h into the 1080×1920 canvas and ignores any
//     unknown enum value, so even a partially-bad node renders empty-but-valid, never throws.
//
// THEME-AGNOSTIC by construction: every colour/font/motion knob comes from useTheme();
// it imports no NH/ANTON/INTER. Colours are PALETTE KEYS (an enum), never raw CSS — there
// is no "arbitrary colour" or "arbitrary image URL" node, so brand-lock is structural.
import React from 'react';
import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { z } from 'zod';
import { useTheme } from '../theme/ThemeContext';
import { GraphicShell, buildReveal } from './GraphicShell';
import { motionForBeat, kenBurnsTransform } from './motion';

// ── canvas + enums ──────────────────────────────────────────────────────────────────
export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
// Cap the node count so a many-node generated beat can't blow up headless render time
// (MOTION_GRAPHICS_SPEC §open-risks: cap ~12).
export const MAX_NODES = 12;
const MAX_TEXT_LEN = 240;

// Palette keys a node may reference — the theme's brand colours, NOT raw CSS.
const PALETTE_KEYS = ['hero', 'heroInk', 'secondary', 'accent', 'alert', 'bg', 'bg2', 'fg'] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

const NODE_KINDS = ['box', 'text', 'number', 'shape', 'image-ref'] as const;
const FONTS = ['display', 'body'] as const;
const ANIMS = ['slideIn', 'countUp', 'pop', 'fade', 'kenburns'] as const;
const SHAPES = ['rect', 'circle', 'bar'] as const;

// ── zod schema (the load-bearing validator — also the render-time gate) ───────────────
const LayoutNodeSchema = z.object({
  kind: z.enum(NODE_KINDS),
  // geometry in canvas px; clamped again at render time as a belt-and-braces guard.
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  color: z.enum(PALETTE_KEYS).optional(),
  font: z.enum(FONTS).optional(),
  text: z.string().max(MAX_TEXT_LEN).optional(),
  // FORBID raw URLs: an image-ref carries a STATIC path the renderer already resolves
  // (e.g. a downloaded story image "images/3.jpg"), never an arbitrary http(s) URL.
  ref: z.string().max(200).optional(),
  shape: z.enum(SHAPES).optional(),
  anim: z.enum(ANIMS).optional(),
  animDelay: z.number().optional(),
  fontSize: z.number().optional(),
  radius: z.number().optional(),
});
export type LayoutNode = z.infer<typeof LayoutNodeSchema>;

export const LayoutSpecSchema = z.object({
  nodes: z.array(LayoutNodeSchema).min(1).max(MAX_NODES),
  // optional flat caption rendered at the foot of the shell
  caption: z.string().max(MAX_TEXT_LEN).optional(),
});
export type LayoutSpec = z.infer<typeof LayoutSpecSchema>;

const clamp = (v: number, lo: number, hi: number): number =>
  Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;

// A reference to a raw URL must never reach <Img>: only a relative static path resolves.
const isStaticRef = (ref: string): boolean => !/^(https?:)?\/\//i.test(ref) && ref.trim().length > 0;

// ── one node → one absolutely-positioned themed element ───────────────────────────────
const Node: React.FC<{ node: LayoutNode; index: number }> = ({ node, index }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = useTheme();

  // Runtime guard: clamp geometry into the canvas so a bad spec renders in-bounds, never
  // off-screen or negative-sized.
  const x = clamp(node.x, 0, CANVAS_W);
  const y = clamp(node.y, 0, CANVAS_H);
  const w = clamp(node.w, 0, CANVAS_W - x);
  const h = clamp(node.h, 0, CANVAS_H - y);

  const colorKey: PaletteKey = (node.color && (PALETTE_KEYS as readonly string[]).includes(node.color)
    ? node.color
    : 'fg') as PaletteKey;
  const color = t.palette[colorKey];
  const font = node.font === 'display' ? t.fonts.display : t.fonts.body;
  const fontWeight = node.font === 'display' ? t.fonts.displayWeight : t.fonts.bodyWeight;

  // ── anim envelope (reuses motion.ts helpers; per-node delay) ───────────────────────
  const delay = clamp(node.animDelay ?? 6 + index * 3, 0, 240);
  const anim = (ANIMS as readonly string[]).includes(node.anim ?? '') ? node.anim : 'fade';

  let opacity = 1;
  let transform = '';
  if (anim === 'fade') {
    opacity = buildReveal(frame, delay, 12);
  } else if (anim === 'slideIn') {
    const inn = spring({ frame: frame - delay, fps, config: { damping: 16, mass: 0.7 } });
    opacity = inn;
    transform = `translateX(${interpolate(inn, [0, 1], [-120, 0])}px)`;
  } else if (anim === 'pop') {
    const pop = spring({ frame: frame - delay, fps, config: { damping: 10, mass: 0.6, stiffness: 160 } });
    opacity = buildReveal(frame, delay, 6);
    transform = `scale(${interpolate(pop, [0, 1], [0.4, 1])})`;
  } else if (anim === 'countUp') {
    opacity = buildReveal(frame, delay, 8);
  } else if (anim === 'kenburns') {
    // resolve a Ken-Burns move over the local frame window (image-ref only; harmless elsewhere)
    opacity = buildReveal(frame, delay, 10);
    transform = kenBurnsTransform(motionForBeat(index), frame, 90, t.motion.kenBurnsAmplitude);
  }

  // countUp on a numeric text/number node: ramp the leading number 0→value.
  let text = node.text;
  if (anim === 'countUp' && text) {
    const m = text.match(/^([^\d.-]*)([\d.,]+)(.*)$/);
    if (m) {
      const target = parseFloat(m[2].replace(/,/g, ''));
      const decimals = m[2].includes('.') ? m[2].split('.')[1].length : 0;
      const ct = interpolate(frame, [delay, delay + 24], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
      if (!Number.isNaN(target)) text = `${m[1]}${(target * ct).toFixed(decimals)}${m[3]}`;
    }
  }

  const base: React.CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width: w,
    height: h,
    opacity,
    transform,
    overflow: 'hidden',
  };

  if (node.kind === 'box') {
    return (
      <div
        style={{
          ...base,
          background: color,
          borderRadius: clamp(node.radius ?? t.motion.cornerRadius, 0, 999),
        }}
      />
    );
  }

  if (node.kind === 'shape') {
    const shape = (SHAPES as readonly string[]).includes(node.shape ?? '') ? node.shape : 'rect';
    const radius = shape === 'circle' ? Math.max(w, h) : shape === 'bar' ? h / 2 : (node.radius ?? 0);
    return <div style={{ ...base, background: color, borderRadius: clamp(radius, 0, 9999) }} />;
  }

  if (node.kind === 'image-ref') {
    // only a static relative path resolves to an <Img>; a raw URL renders an empty box.
    if (!node.ref || !isStaticRef(node.ref)) {
      return <div style={{ ...base, background: t.palette.bg2 }} />;
    }
    return (
      <div style={{ ...base, background: t.palette.bg2 }}>
        <Img
          src={staticFile(node.ref)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform }}
        />
      </div>
    );
  }

  // text / number — display vs body font, hero ink stroke on display so it reads as brand.
  const isDisplay = node.font === 'display' || node.kind === 'number';
  return (
    <div
      style={{
        ...base,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        fontFamily: isDisplay ? t.fonts.display : font,
        fontWeight: isDisplay ? t.fonts.displayWeight : fontWeight,
        fontSize: clamp(node.fontSize ?? (node.kind === 'number' ? 160 : 52), 8, 360),
        lineHeight: 1,
        letterSpacing: 1,
        color,
        textTransform: node.kind === 'number' ? 'none' : 'uppercase',
        WebkitTextStroke: isDisplay ? `${t.motion.strokeWeight}px ${t.palette.heroInk}` : undefined,
      }}
    >
      {text ?? ''}
    </div>
  );
};

// Themed salvage card when the whole spec is invalid (mirrors StoryBeats' FallbackCard).
const FallbackCard: React.FC = () => {
  const t = useTheme();
  return (
    <GraphicShell>
      <div
        style={{
          fontFamily: t.fonts.display,
          fontWeight: t.fonts.displayWeight,
          fontSize: 120,
          color: t.palette.hero,
          WebkitTextStroke: `${t.motion.strokeWeight}px ${t.palette.heroInk}`,
          textAlign: 'center',
          maxWidth: 920,
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        —
      </div>
    </GraphicShell>
  );
};

// ── the primitive ─────────────────────────────────────────────────────────────────────
// `spec` is unknown until validated — StoryBeats passes the raw `v.spec` straight through.
export const LayoutBeat: React.FC<{ spec: unknown }> = ({ spec }) => {
  const t = useTheme();
  const frame = useCurrentFrame();
  const parsed = LayoutSpecSchema.safeParse(spec);
  if (!parsed.success) return <FallbackCard />;
  const { nodes, caption } = parsed.data;

  return (
    <GraphicShell align="stretch">
      {/* full-canvas node plane; nodes are absolutely positioned inside it */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {nodes.map((node, i) => (
          <Node key={i} node={node} index={i} />
        ))}
      </div>
      {caption && (
        <div
          style={{
            position: 'absolute',
            left: 60,
            right: 60,
            bottom: 80,
            textAlign: 'center',
            fontFamily: t.fonts.body,
            fontWeight: 800,
            fontSize: 44,
            color: t.palette.fg,
            textTransform: 'uppercase',
            letterSpacing: 1,
            opacity: buildReveal(frame, 8 + nodes.length * 3, 12),
          }}
        >
          {caption}
        </div>
      )}
    </GraphicShell>
  );
};
