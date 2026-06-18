// Catalog composition (visual-component-library §3.2) — the "Storybook for Remotion".
//
// Renders every REGISTRY entry's examples in a labelled grid; each cell is the block
// rendered inside its own <ThemeProvider> with the chosen theme, plus a header
// (id · example name · approvedFor.james badge). id="Catalog" plays the envelope;
// id="CatalogStill" is the single-frame contact-sheet variant.
//
// Presentation-only: a SEPARATE composition — it never touches computeTimeline()/the
// SYNC ASSERTION. Theme-agnostic: every block reads useTheme() from the cell's provider.
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { ThemeProvider } from '../theme/ThemeContext';
import { parseTheme, type Theme } from '../theme/tokens';
import { REGISTRY } from '../graphics/registry';
import type { CatalogEntry, CatalogStatus } from '../graphics/types';
import jamesRaw from '../theme/themes/james.theme.json';
import demoCoolRaw from '../theme/themes/_demo-cool.theme.json';

export const CATALOG_THEMES: Record<string, Theme> = {
  james: parseTheme(jamesRaw),
  '_demo-cool': parseTheme(demoCoolRaw),
};

// ── layout ────────────────────────────────────────────────────────────────────────────
export const CATALOG_W = 2160;
const COLS = 3;
const CELL_W = CATALOG_W / COLS; // 720
const CELL_H = 920; // each cell holds a 1080×1920 block scaled down + a header
const HEADER_H = 96;
const STAGE_W = 1080;
const STAGE_H = 1920;

export type CatalogProps = {
  theme: 'james' | '_demo-cool';
  filterKind?: string;
  filterTag?: string;
  frozenFrame?: number; // CatalogStill freezes every cell at this local frame
};

const STATUS_COLOR: Record<CatalogStatus, string> = {
  approved: '#3DDC97',
  review: '#FFC01E',
  draft: '#8A93A6',
  deprecated: '#FF3B30',
};

// One flattened (entry, example) cell.
type Cell = { entry: CatalogEntry; exampleName: string; data: any };

const flatten = (entries: CatalogEntry[]): Cell[] =>
  entries.flatMap((entry) =>
    entry.examples.map((ex) => ({ entry, exampleName: ex.name, data: ex.data })),
  );

// A single cell: header label + the block scaled to fit, wrapped in its theme provider.
const CatalogCell: React.FC<{ cell: Cell; theme: Theme; frozenFrame?: number }> = ({
  cell,
  theme,
  frozenFrame,
}) => {
  const { entry, exampleName, data } = cell;
  const Comp = entry.Comp as React.FC<any>;
  const status = entry.approvedFor.james ?? 'draft';
  // scale the full 1080×1920 stage into the cell body
  const bodyH = CELL_H - HEADER_H;
  const scale = Math.min((CELL_W - 24) / STAGE_W, (bodyH - 24) / STAGE_H);

  const block = (
    <ThemeProvider theme={theme}>
      <Comp {...data} />
    </ThemeProvider>
  );

  return (
    <div
      style={{
        width: CELL_W,
        height: CELL_H,
        boxSizing: 'border-box',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* header */}
      <div style={{ height: HEADER_H - 16, display: 'flex', alignItems: 'center', gap: 10, color: '#E6EAF2' }}>
        <span style={{ fontFamily: 'monospace', fontSize: 22, color: '#9AA4B8' }}>{entry.id}</span>
        <span style={{ fontFamily: 'monospace', fontSize: 22, color: '#E6EAF2', fontWeight: 700 }}>
          · {exampleName}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontFamily: 'monospace',
            fontSize: 18,
            fontWeight: 700,
            color: '#0B1220',
            background: STATUS_COLOR[status],
            borderRadius: 6,
            padding: '4px 10px',
          }}
        >
          james: {status}
        </span>
      </div>
      {/* stage */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          background: '#000',
          border: '1px solid rgba(255,255,255,0.10)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            width: STAGE_W,
            height: STAGE_H,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {frozenFrame === undefined ? (
            block
          ) : (
            // freeze every cell at a single frame for the still contact sheet
            <Sequence from={-frozenFrame} layout="none">
              {block}
            </Sequence>
          )}
        </div>
      </div>
    </div>
  );
};

const selectEntries = (filterKind?: string, filterTag?: string): CatalogEntry[] =>
  REGISTRY.filter(
    (e) =>
      (!filterKind || e.kind === filterKind) && (!filterTag || e.tags.includes(filterTag)),
  );

// Height is computed from the cell count so the canvas always fits.
export const catalogHeight = (filterKind?: string, filterTag?: string): number => {
  const cells = flatten(selectEntries(filterKind, filterTag)).length;
  const rows = Math.max(1, Math.ceil(cells / COLS));
  return rows * CELL_H + 120; // + title strip
};

export const Catalog: React.FC<CatalogProps> = ({ theme, filterKind, filterTag, frozenFrame }) => {
  const themeObj = CATALOG_THEMES[theme] ?? CATALOG_THEMES.james;
  const cells = flatten(selectEntries(filterKind, filterTag));

  return (
    <AbsoluteFill style={{ background: '#080B12' }}>
      {/* title strip */}
      <div
        style={{
          height: 120,
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          gap: 16,
          color: '#E6EAF2',
          fontFamily: 'monospace',
        }}
      >
        <span style={{ fontSize: 40, fontWeight: 800 }}>GRAPHIC CATALOG</span>
        <span style={{ fontSize: 26, color: '#9AA4B8' }}>theme: {theme}</span>
        {filterKind && <span style={{ fontSize: 26, color: '#9AA4B8' }}>kind: {filterKind}</span>}
        {filterTag && <span style={{ fontSize: 26, color: '#9AA4B8' }}>tag: {filterTag}</span>}
        <span style={{ marginLeft: 'auto', fontSize: 24, color: '#9AA4B8' }}>{cells.length} cells</span>
      </div>
      {/* grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start' }}>
        {cells.map((cell, i) => (
          <CatalogCell key={`${cell.entry.id}-${cell.exampleName}-${i}`} cell={cell} theme={themeObj} frozenFrame={frozenFrame} />
        ))}
      </div>
    </AbsoluteFill>
  );
};

// CatalogStill — single-frame contact sheet (freeze every cell at frame 30).
export const CatalogStill: React.FC<CatalogProps> = (props) => (
  <Catalog {...props} frozenFrame={props.frozenFrame ?? 30} />
);
