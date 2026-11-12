import type { RefObject, TargetedKeyboardEvent, TargetedPointerEvent } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { aspectOf, displayToSource, moveRect, nudgeRect, rectToPercent, resizeRect, type Handle, type NudgeKey, type Rect, type Size } from './crop';

interface Props {
  src: string;
  natural: Size | null;
  rect: Rect | null;
  lockAspect: boolean;
  imgRef: RefObject<HTMLImageElement | null>;
  onChange: (r: Rect) => void;
  onImageLoad: (img: HTMLImageElement) => void;
}

const MIN_SIZE = 4; // source px
const HANDLES: Array<[Handle, string]> = [
  ['nw', 'left-0 top-0 cursor-nwse-resize'],
  ['n', 'left-1/2 top-0 cursor-ns-resize'],
  ['ne', 'left-full top-0 cursor-nesw-resize'],
  ['e', 'left-full top-1/2 cursor-ew-resize'],
  ['se', 'left-full top-full cursor-nwse-resize'],
  ['s', 'left-1/2 top-full cursor-ns-resize'],
  ['sw', 'left-0 top-full cursor-nesw-resize'],
  ['w', 'left-0 top-1/2 cursor-ew-resize'],
];

interface Drag { kind: 'move' | Handle; px: number; py: number; start: Rect; w: number; h: number }

/** Crop box over the picture. Geometry lives in CSS variables set from JS; all maths is in ./crop (source pixels). */
export default function CropEditor({ src, natural, rect, lockAspect, imgRef, onChange, onImageLoad }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el || !rect || !natural) return;
    const p = rectToPercent(rect, natural);
    el.style.setProperty('--cx', `${p.left}%`);
    el.style.setProperty('--cy', `${p.top}%`);
    el.style.setProperty('--cw', `${p.width}%`);
    el.style.setProperty('--ch', `${p.height}%`);
  }, [rect, natural]);

  const begin = (kind: Drag['kind']) => (e: TargetedPointerEvent<HTMLElement>) => {
    if (!rect || !natural || !imgRef.current || e.button > 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const b = imgRef.current.getBoundingClientRect();
    drag.current = { kind, px: e.clientX, py: e.clientY, start: rect, w: b.width, h: b.height };
  };
  const move = (e: TargetedPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || !natural) return;
    const dx = displayToSource(e.clientX - d.px, natural.width, d.w);
    const dy = displayToSource(e.clientY - d.py, natural.height, d.h);
    onChange(d.kind === 'move' ? moveRect(d.start, dx, dy, natural) : resizeRect(d.start, d.kind, dx, dy, natural, { aspect: lockAspect ? aspectOf(d.start) : null, minSize: MIN_SIZE }));
  };
  const end = (e: TargetedPointerEvent<HTMLElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onKey = (e: TargetedKeyboardEvent<HTMLDivElement>) => {
    if (!rect || !natural || !e.key.startsWith('Arrow')) return;
    e.preventDefault();
    onChange(nudgeRect(rect, e.key as NudgeKey, e.shiftKey ? 10 : 1, natural, e.altKey ? 'resize' : 'move', lockAspect ? aspectOf(rect) : null));
  };

  return (
    <div ref={wrap} data-testid="crop-editor" className="relative mx-auto w-fit max-w-full overflow-hidden rounded-lg border border-slate-300 bg-white">
      <img
        ref={imgRef}
        src={src}
        alt="Your signature image, with the crop box on top"
        data-testid="crop-image"
        draggable={false}
        className="block max-h-[60vh] max-w-full select-none"
        onLoad={(e) => onImageLoad(e.currentTarget)}
      />
      {rect && natural && (
        <div
          data-testid="crop-box"
          role="group"
          tabIndex={0}
          aria-label={`Crop box: left ${rect.x}, top ${rect.y}, ${rect.width} by ${rect.height} pixels. Arrow keys move it, Alt plus arrow keys resize it, Shift makes the steps larger.`}
          onKeyDown={onKey}
          onPointerDown={begin('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          className="absolute left-[var(--cx)] top-[var(--cy)] h-[var(--ch)] w-[var(--cw)] cursor-move touch-none border-2 border-white outline outline-1 outline-indigo-900 shadow-[0_0_0_9999px_rgba(15,23,42,0.55)] focus-visible:outline-2 focus-visible:outline-yellow-300"
        >
          {HANDLES.map(([h, pos]) => (
            <div
              key={h}
              data-handle={h}
              aria-hidden="true"
              onPointerDown={begin(h)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              className={`absolute flex size-8 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center ${pos}`}
            >
              <span className="block size-3.5 rounded-full border-2 border-indigo-900 bg-white" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
