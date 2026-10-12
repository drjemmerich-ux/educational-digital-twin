// Educational DICOM-style viewer for PNG/web image stacks. Not a diagnostic PACS: no native DICOM,
// no calibrated measurement, no MPR. Missing approved frames render as explicit technical placeholders.
import * as React from 'react';
import type { ReleasedSeries } from '../engine/types.ts';

export interface ViewerProps {
  series: ReleasedSeries[];
  studyTitle: string;
  acquiredLabel: string;
  compareOptions?: { key: string; label: string; series: ReleasedSeries; studyTitle: string }[];
  onPlaceholderShown?: (assetId: string) => void;
  onLoadError?: (assetId: string, detail: string) => void;
}

function PlaceholderFrame(props: { s: ReleasedSeries; frame: number; total: number }) {
  return (
    <svg className="viewer-frame" viewBox="0 0 512 512" role="img" aria-label={`Technical placeholder for ${props.s.title}, frame ${props.frame} of ${props.total}. No image content.`}>
      <rect width="512" height="512" fill="#0b0e12" />
      <g stroke="#1d2530" strokeWidth="1">
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`v${i}`} x1={(i + 1) * 32} y1="0" x2={(i + 1) * 32} y2="512" />
        ))}
        {Array.from({ length: 15 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={(i + 1) * 32} x2="512" y2={(i + 1) * 32} />
        ))}
      </g>
      <rect x="96" y="196" width="320" height="120" fill="#11161d" stroke="#3a4757" />
      <text x="256" y="236" textAnchor="middle" fill="#c9d3de" fontFamily="Arial" fontSize="17" fontWeight="bold">
        TECHNICAL PLACEHOLDER
      </text>
      <text x="256" y="262" textAnchor="middle" fill="#9aa7b5" fontFamily="Arial" fontSize="13">
        Not a clinical image · approved frames pending
      </text>
      <text x="256" y="290" textAnchor="middle" fill="#9aa7b5" fontFamily="Arial" fontSize="13">
        {props.s.assetId} · frame {props.frame} of {props.total} (planned)
      </text>
    </svg>
  );
}

function Pane(props: {
  s: ReleasedSeries;
  frame: number;
  total: number;
  zoom: number;
  pan: { x: number; y: number };
  brightness: number;
  contrast: number;
  onLoadError?: (assetId: string, detail: string) => void;
}) {
  const [failed, setFailed] = React.useState(false);
  const path = props.s.framePaths?.[props.frame - 1] ?? null;
  const style: React.CSSProperties = {
    transform: `translate(${props.pan.x}px, ${props.pan.y}px) scale(${props.zoom})`,
    filter: `brightness(${props.brightness}%) contrast(${props.contrast}%)`,
  };
  return (
    <div className="viewer-stage-inner" style={style}>
      {path && !failed ? (
        <img
          className="viewer-frame"
          src={path}
          alt={`${props.s.title}, frame ${props.frame} of ${props.total}`}
          onError={() => {
            setFailed(true);
            props.onLoadError?.(props.s.assetId, `Frame ${props.frame} failed to load`);
          }}
        />
      ) : (
        <PlaceholderFrame s={props.s} frame={props.frame} total={props.total} />
      )}
      {failed ? <div className="viewer-error">Image failed to load. Showing placeholder.</div> : null}
    </div>
  );
}

export function StudyViewer(props: ViewerProps) {
  const [seriesIdx, setSeriesIdx] = React.useState(0);
  const [frame, setFrame] = React.useState(1);
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [compareKey, setCompareKey] = React.useState<string>('');
  const [compareFrame, setCompareFrame] = React.useState(1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const s = props.series[Math.min(seriesIdx, props.series.length - 1)];
  const total = s ? (s.framePaths ? s.framePaths.length : s.plannedFrameCount) : 0;
  const compare = props.compareOptions?.find((c) => c.key === compareKey) ?? null;
  const compareTotal = compare ? compare.series.framePaths?.length ?? compare.series.plannedFrameCount : 0;

  React.useEffect(() => {
    if (s?.placeholder) props.onPlaceholderShown?.(s.assetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.assetId]);

  const clampFrame = (f: number) => Math.max(1, Math.min(total, f));
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setBrightness(100);
    setContrast(100);
  };

  // Wheel: slice navigation; Ctrl/Cmd + wheel: zoom. Native listener so preventDefault works.
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) setZoom((z) => Math.max(0.5, Math.min(4, z * (e.deltaY < 0 ? 1.1 : 0.9))));
      else setFrame((f) => Math.max(1, Math.min(total, f + (e.deltaY > 0 ? 1 : -1))));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [total]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    const k = e.key;
    if (k === 'ArrowDown' || k === 'ArrowRight' || k === 'PageDown') setFrame((f) => clampFrame(f + 1));
    else if (k === 'ArrowUp' || k === 'ArrowLeft' || k === 'PageUp') setFrame((f) => clampFrame(f - 1));
    else if (k === 'Home') setFrame(1);
    else if (k === 'End') setFrame(total);
    else if (k === '+' || k === '=') setZoom((z) => Math.min(4, z * 1.2));
    else if (k === '-') setZoom((z) => Math.max(0.5, z / 1.2));
    else if (k === '0') reset();
    else if (k === 'f' || k === 'F') toggleFullscreen();
    else return;
    e.preventDefault();
  };

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
      else void el.requestFullscreen?.().catch(() => undefined);
    } catch {
      /* fullscreen is optional */
    }
  };

  if (!s) return <p className="muted">No images are part of this study.</p>;

  return (
    <div className="viewer" ref={rootRef}>
      <div className="viewer-toolbar" role="toolbar" aria-label="Image viewer controls">
        <label className="sr-only" htmlFor="viewer-series">
          Series
        </label>
        <select
          id="viewer-series"
          value={seriesIdx}
          onChange={(e) => {
            setSeriesIdx(Number(e.target.value));
            setFrame(1);
          }}
        >
          {props.series.map((x, i) => (
            <option key={x.assetId} value={i}>
              {x.title}
            </option>
          ))}
        </select>
        <button type="button" className="tool" onClick={() => setZoom((z) => Math.min(4, z * 1.2))} aria-label="Zoom in">
          +
        </button>
        <button type="button" className="tool" onClick={() => setZoom((z) => Math.max(0.5, z / 1.2))} aria-label="Zoom out">
          −
        </button>
        <button type="button" className="tool" onClick={reset}>
          Reset
        </button>
        <button type="button" className="tool" onClick={toggleFullscreen}>
          Full screen
        </button>
        {props.compareOptions && props.compareOptions.length ? (
          <>
            <label htmlFor="viewer-compare" className="tool-label">
              Compare with
            </label>
            <select
              id="viewer-compare"
              value={compareKey}
              onChange={(e) => {
                setCompareKey(e.target.value);
                setCompareFrame(1);
              }}
            >
              <option value="">None</option>
              {props.compareOptions.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      <div className={`viewer-panes ${compare ? 'split' : ''}`}>
        <div
          className="viewer-stage"
          ref={stageRef}
          tabIndex={0}
          role="group"
          aria-label={`${s.title}. Use arrow keys to change frame, plus and minus to zoom, 0 to reset, F for full screen.`}
          onKeyDown={onKey}
          onPointerDown={(e) => {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
          }}
          onPointerUp={() => (drag.current = null)}
        >
          <Pane s={s} frame={frame} total={total} zoom={zoom} pan={pan} brightness={brightness} contrast={contrast} onLoadError={props.onLoadError} />
          <div className="viewer-overlay tl">
            {props.studyTitle}
            <br />
            {s.title}
          </div>
          <div className="viewer-overlay tr">
            Frame {frame}/{total}
            <br />
            Zoom {Math.round(zoom * 100)}%
          </div>
          <div className="viewer-overlay bl">
            {props.acquiredLabel}
            <br />
            Orientation: unverified · Spacing: unverified
          </div>
          <div className="viewer-overlay br">{s.placeholder ? 'SYNTHETIC · PLACEHOLDER' : `SYNTHETIC · ${s.approvalState.toUpperCase()}`}</div>
        </div>
        {compare ? (
          <div className="viewer-stage compare" tabIndex={0} aria-label={`Comparison: ${compare.label}`} onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { setCompareFrame((f) => Math.min(compareTotal, f + 1)); e.preventDefault(); }
            if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { setCompareFrame((f) => Math.max(1, f - 1)); e.preventDefault(); }
          }}>
            <Pane s={compare.series} frame={compareFrame} total={compareTotal} zoom={1} pan={{ x: 0, y: 0 }} brightness={100} contrast={100} onLoadError={props.onLoadError} />
            <div className="viewer-overlay tl">
              {compare.studyTitle}
              <br />
              {compare.series.title}
            </div>
            <div className="viewer-overlay tr">
              Frame {compareFrame}/{compareTotal}
            </div>
            <div className="viewer-overlay br">{compare.series.placeholder ? 'SYNTHETIC · PLACEHOLDER' : 'SYNTHETIC'}</div>
          </div>
        ) : null}
      </div>

      <div className="viewer-controls">
        <label htmlFor="viewer-slice">Frame</label>
        <input id="viewer-slice" type="range" min={1} max={Math.max(1, total)} value={frame} disabled={total <= 1} onChange={(e) => setFrame(Number(e.target.value))} />
        <span className="tabular">
          {frame} / {total}
        </span>
        <label htmlFor="viewer-bright">Display brightness</label>
        <input id="viewer-bright" type="range" min={50} max={150} value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} />
        <label htmlFor="viewer-contrast">Display contrast</label>
        <input id="viewer-contrast" type="range" min={50} max={150} value={contrast} onChange={(e) => setContrast(Number(e.target.value))} />
      </div>
      {s.placeholder ? (
        <p className="placeholder-note">
          Approved synthetic images for this series are not yet available. The frame count follows the planned series ({s.plannedFrameCount}{' '}
          {s.plannedFrameCount === 1 ? 'projection' : 'frames'}). Placeholders contain no diagnostic content and are not clinically validated. Display
          brightness and contrast adjust the screen rendering only; they are not CT windowing.
        </p>
      ) : null}
    </div>
  );
}
