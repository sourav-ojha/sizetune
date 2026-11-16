import type { ComponentChildren } from 'preact';

/** Class for a native <select> inside <SelectBox>: WebKit ignores min-height on a native-looking select (26 px), so appearance is reset and the arrow drawn by SelectBox. */
export const selectCls = 'appearance-none pr-10';

/** Wraps a <select> (given selectCls + inputCls) with a CSS-drawn arrow; the select stays a real, keyboard- and screen-reader-native control. */
export default function SelectBox({ children }: { children: ComponentChildren }) {
  return (
    <div className="relative mt-1">
      {children}
      <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 size-2.5 -translate-y-[70%] rotate-45 border-b-2 border-r-2 border-slate-700" />
    </div>
  );
}
