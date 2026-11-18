import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { buildMatrix, toPixels, toSvg, urlPayload, wifiPayload, MAX_QR_CHARS, type Ecl, type WifiSecurity } from '../lib/qr';
import { btnSecondary, btnToggleOff, btnToggleOn, errCls, fieldsetCls, hintCls, inputCls, labelCls, legendCls, panelCls } from './tool/ui';

type Kind = 'url' | 'text' | 'wifi';
const KINDS: Array<[Kind, string]> = [['url', 'Web address'], ['text', 'Text'], ['wifi', 'Wi-Fi']];
const ECLS: Array<[Ecl, string]> = [['L', 'Low (7% repairable)'], ['M', 'Medium (15%)'], ['Q', 'Quartile (25%)'], ['H', 'High (30%)']];
const SIZES = [256, 512, 1024];

/** Makes a QR code from a web address, text or Wi-Fi details. Everything runs in the browser; nothing is stored or sent. */
export default function QrTool() {
  const [kind, setKind] = useState<Kind>('url');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [security, setSecurity] = useState<WifiSecurity>('WPA');
  const [hidden, setHidden] = useState(false);
  const [ecl, setEcl] = useState<Ecl>('M');
  const [size, setSize] = useState(512);
  const [pngUrl, setPngUrl] = useState('');
  const [svgUrl, setSvgUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const payload = kind === 'url' ? urlPayload(url) : kind === 'text' ? urlPayload(text) : wifiPayload({ ssid, password, security, hidden });
  const matrix = useMemo(() => (payload ? buildMatrix(payload, ecl) : null), [payload, ecl]);
  const tooLong = payload !== null && matrix === null;

  // Preview and download files. Object URLs are revoked when the code changes and when the tool goes away.
  useEffect(() => {
    if (!matrix) { setPngUrl(''); setSvgUrl(''); return; }
    const made: string[] = [];
    let alive = true;
    const cell = Math.max(1, Math.floor(size / (matrix.length + 8)));
    const px = toPixels(matrix, cell, 4);
    const draw = (cv: HTMLCanvasElement) => {
      cv.width = px.width; cv.height = px.height;
      cv.getContext('2d')?.putImageData(new ImageData(px.data, px.width, px.height), 0, 0);
    };
    if (canvasRef.current) draw(canvasRef.current);
    const off = document.createElement('canvas');
    draw(off);
    off.toBlob((b) => {
      if (!b || !alive) return;
      const u = URL.createObjectURL(b); made.push(u); setPngUrl(u);
    }, 'image/png');
    const svg = URL.createObjectURL(new Blob([toSvg(matrix, 4)], { type: 'image/svg+xml' }));
    made.push(svg); setSvgUrl(svg);
    return () => { alive = false; for (const u of made) URL.revokeObjectURL(u); };
  }, [matrix, size]);

  const field = (id: string, label: string, el: preact.ComponentChildren, hint?: string) => (
    <div>
      <label htmlFor={id} className={labelCls}>{label}</label>
      {el}
      {hint && <p className={hintCls}>{hint}</p>}
    </div>
  );

  return (
    <section data-testid="tool" aria-label="QR code generator" className={`${panelCls} lg:p-8`}>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5">
          <fieldset className={fieldsetCls}>
            <legend className={legendCls}>What the code holds</legend>
            <div className="flex flex-wrap gap-2">
              {KINDS.map(([k, label]) => (
                <button key={k} type="button" data-testid={`kind-${k}`} aria-pressed={kind === k} className={kind === k ? btnToggleOn : btnToggleOff} onClick={() => setKind(k)}>{label}</button>
              ))}
            </div>
          </fieldset>

          {kind === 'url' && field('qr-url', 'Web address', <input id="qr-url" data-testid="qr-url" type="text" inputMode="url" autoComplete="off" spellcheck={false} className={inputCls} value={url} onInput={(e) => setUrl((e.target as HTMLInputElement).value)} />, 'Type the full address, including the https part at the start. It is encoded exactly as typed.')}
          {kind === 'text' && field('qr-text', 'Text', <textarea id="qr-text" data-testid="qr-text" rows={5} className={`${inputCls} resize-y`} value={text} onInput={(e) => setText((e.target as HTMLTextAreaElement).value)} />)}
          {kind === 'wifi' && (
            <div className="space-y-4">
              {field('qr-ssid', 'Network name', <input id="qr-ssid" data-testid="qr-ssid" type="text" autoComplete="off" spellcheck={false} className={inputCls} value={ssid} onInput={(e) => setSsid((e.target as HTMLInputElement).value)} />)}
              {security !== 'nopass' && field('qr-pass', 'Password', <input id="qr-pass" data-testid="qr-pass" type="text" autoComplete="off" spellcheck={false} className={inputCls} value={password} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />, 'Shown as you type so you can check it. It stays on this device.')}
              {field('qr-sec', 'Security', (
                <select id="qr-sec" data-testid="qr-sec" className={inputCls} value={security} onChange={(e) => setSecurity((e.target as HTMLSelectElement).value as WifiSecurity)}>
                  <option value="WPA">WPA or WPA2 or WPA3</option>
                  <option value="WEP">WEP</option>
                  <option value="nopass">No password</option>
                </select>
              ))}
              <label className="flex min-h-11 items-center gap-3 text-base text-slate-900">
                <input type="checkbox" data-testid="qr-hidden" className="size-5 accent-teal-700" checked={hidden} onChange={(e) => setHidden((e.target as HTMLInputElement).checked)} />
                Hidden network
              </label>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {field('qr-ecl', 'Error correction', (
              <select id="qr-ecl" data-testid="qr-ecl" className={inputCls} value={ecl} onChange={(e) => setEcl((e.target as HTMLSelectElement).value as Ecl)}>
                {ECLS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ), 'Higher survives more damage but makes a denser code.')}
            {field('qr-size', 'PNG size', (
              <select id="qr-size" data-testid="qr-size" className={inputCls} value={String(size)} onChange={(e) => setSize(Number((e.target as HTMLSelectElement).value))}>
                {SIZES.map((s) => <option key={s} value={s}>About {s} px</option>)}
              </select>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div role="status" aria-live="polite" data-testid="qr-status">
            {tooLong && <p className={errCls} data-testid="qr-error">That is more than a QR code can hold ({MAX_QR_CHARS.toLocaleString('en-US')} characters at most). Shorten it.</p>}
            {!payload && <p className={hintCls} data-testid="qr-empty">Enter {kind === 'wifi' ? 'the network name' : kind === 'url' ? 'a web address' : 'some text'} to make a code.</p>}
            {matrix && <p className={hintCls} data-testid="qr-info">{matrix.length} × {matrix.length} squares. Scan it with a phone camera to check it.</p>}
          </div>
          <div className={matrix ? 'flex justify-center rounded-2xl border border-slate-200 bg-white p-4' : 'hidden'}>
            <canvas ref={canvasRef} data-testid="qr-canvas" role="img" aria-label="The QR code" className="size-64 max-w-full [image-rendering:pixelated]" />
          </div>
          {matrix && (
            <div className="flex flex-wrap gap-3">
              <a data-testid="qr-png" href={pngUrl || undefined} download="qr-code.png" aria-disabled={!pngUrl} className={btnSecondary}>Download PNG</a>
              <a data-testid="qr-svg" href={svgUrl || undefined} download="qr-code.svg" aria-disabled={!svgUrl} className={btnSecondary}>Download SVG</a>
            </div>
          )}
          {matrix && <p className={hintCls} data-testid="qr-warn">Test the code with a phone before you print it or share it widely. Dark squares on a light background scan best.</p>}
        </div>
      </div>
    </section>
  );
}
