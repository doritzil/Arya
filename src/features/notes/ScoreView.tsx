'use dom';

import createVerovioModule from 'verovio/wasm';
import { VerovioToolkit } from 'verovio/esm';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Engraved score (FR-14, FR-15, FR-18): Verovio (WASM) rendering our MEI inside an Expo DOM component,
 * bundled with the app so it works offline. Every note's xml:id is our note id, so highlight (playing
 * note) and selection (edit) are CSS on element ids — no re-layout per frame (ARCHITECTURE §7.4).
 *
 * Licence gate: Verovio is LGPL-3.0. It ships as a separate, replaceable WASM module; confirm with
 * counsel before release, or swap for OpenSheetMusicDisplay behind these same props.
 */
export interface ScoreViewProps {
  mei: string;
  /** Note ids sounding now (glow in accent). */
  currentIds?: string[];
  /** Note id being edited (ringed). */
  selectedId?: string | null;
  ink: string;
  accent: string;
  accentSoft: string;
  /** Zoom, 30–80 (Verovio scale). */
  scale?: number;
  onTapNote?: (id: string) => void;
  onRendered?: (info: { pages: number; ms: number }) => void;
  /** Receives the engraved pages as SVG strings (used for PDF export). */
  onSvg?: (pages: string[]) => void;
  /** Fixed viewport height: the score scrolls inside it and keeps the sounding note in view. */
  viewportHeight?: number;
  dom?: import('expo/dom').DOMProps;
}

let toolkitPromise: Promise<VerovioToolkit> | null = null;
function getToolkit() {
  toolkitPromise ??= createVerovioModule().then((m: unknown) => new VerovioToolkit(m));
  return toolkitPromise;
}

export default function ScoreView({
  mei,
  currentIds = [],
  selectedId,
  ink,
  accent,
  accentSoft,
  scale = 40,
  onTapNote,
  onRendered,
  onSvg,
  viewportHeight,
}: ScoreViewProps) {
  const [svg, setSvg] = useState<string>('');
  const [width, setWidth] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);

  // Follow playback: bring the first sounding note's system into view, scrolling only our own box (never
  // the page — on web this component renders inline).
  const firstCurrent = currentIds[0];
  useEffect(() => {
    const box = viewport.current;
    if (!viewportHeight || !box || !firstCurrent) return;
    const el = host.current?.querySelector(`#${cssId(firstCurrent)}`);
    if (!el) return;
    const system = el.closest('.system') ?? el;
    const top = system.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    const h = system.getBoundingClientRect().height;
    if (top < box.scrollTop || top + h > box.scrollTop + box.clientHeight) {
      box.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' });
    }
  }, [firstCurrent, viewportHeight, svg]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!mei || width < 50) return;
    let alive = true;
    getToolkit().then((tk) => {
      const t0 = performance.now();
      tk.setOptions({
        pageWidth: Math.round((width * 100) / scale),
        scale,
        adjustPageHeight: true,
        pageMarginLeft: 20,
        pageMarginRight: 20,
        pageMarginTop: 10,
        pageMarginBottom: 10,
        breaks: 'auto',
        header: 'none',
        footer: 'none',
        svgViewBox: true,
        svgRemoveXlink: true,
      });
      tk.loadData(mei);
      const pages = tk.getPageCount();
      const out: string[] = [];
      for (let p = 1; p <= pages; p++) out.push(tk.renderToSVG(p));
      if (!alive) return;
      setSvg(out.join(''));
      onRendered?.({ pages, ms: Math.round(performance.now() - t0) });
      onSvg?.(out);
    });
    return () => {
      alive = false;
    };
  }, [mei, width, scale, onRendered, onSvg]);

  const css = useMemo(() => {
    const cur = currentIds.map((id) => `#${cssId(id)}`).join(',');
    const sel = selectedId ? `#${cssId(selectedId)}` : '';
    return `
      html,body{margin:0;padding:0;background:transparent;}
      .score svg{display:block;width:100%;height:auto;color:${ink};}
      .score svg g, .score svg path, .score svg use, .score svg text, .score svg rect, .score svg polygon, .score svg ellipse{fill:${ink};stroke:${ink};}
      .score svg path{stroke:${ink};}
      .score svg .note{cursor:pointer;}
      ${cur ? `${cur}{fill:${accent} !important;} ${cur} *{fill:${accent} !important;stroke:${accent} !important;}` : ''}
      ${sel ? `${sel} .notehead *{fill:${accent} !important;} ${sel} .notehead{filter:drop-shadow(0 0 3px ${accentSoft}) drop-shadow(0 0 6px ${accent});}` : ''}
    `;
  }, [currentIds, selectedId, ink, accent, accentSoft]);

  return (
    <div
      ref={viewport}
      style={viewportHeight ? { width: '100%', height: viewportHeight, overflowY: 'auto', WebkitOverflowScrolling: 'touch' } : { width: '100%' }}>
      <style>{css}</style>
      <div
        ref={host}
        className="score"
        role="img"
        aria-label="Score"
        onClick={(e) => {
          const note = (e.target as Element).closest?.('.note');
          if (note?.id) onTapNote?.(note.id);
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}

const cssId = (id: string) => id.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
