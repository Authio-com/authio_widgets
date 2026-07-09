/**
 * Inline CSS for the widget surfaces. We deliberately ship a single
 * scoped style block (data-attribute-namespaced selectors) so the
 * widget renders identically across host CSS environments without
 * pulling Tailwind / Radix Themes / etc. into the bundle.
 *
 * The selectors are namespaced under `[data-authio-widget]` so a host
 * style with the same class name doesn't bleed in.
 */

export const WIDGET_CSS = /* css */ `
[data-authio-widget] {
  --aw-bg: #ffffff;
  --aw-fg: #0f172a;
  --aw-muted: #64748b;
  --aw-border: #e2e8f0;
  --aw-accent: #2563eb;
  --aw-accent-fg: #ffffff;
  --aw-success: #16a34a;
  --aw-danger: #dc2626;
  --aw-radius: 8px;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--aw-fg);
  background: var(--aw-bg);
  font-size: 14px;
  line-height: 1.5;
  border: 1px solid var(--aw-border);
  border-radius: var(--aw-radius);
  padding: 16px;
  box-sizing: border-box;
}
[data-authio-widget][data-theme="dark"] {
  --aw-bg: #0b1120;
  --aw-fg: #f1f5f9;
  --aw-muted: #94a3b8;
  --aw-border: #1e293b;
  --aw-accent: #3b82f6;
}
[data-authio-widget] * { box-sizing: border-box; }
[data-authio-widget] header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px; gap: 8px;
}
[data-authio-widget] h2 {
  font-size: 16px; font-weight: 600; margin: 0;
}
[data-authio-widget] p.aw-muted { color: var(--aw-muted); margin: 0 0 12px 0; font-size: 13px; }
[data-authio-widget] button.aw-btn {
  display: inline-flex; align-items: center; justify-content: center;
  height: 32px; padding: 0 12px;
  border: 1px solid var(--aw-border); border-radius: 6px;
  background: var(--aw-bg); color: var(--aw-fg); cursor: pointer;
  font-size: 13px; font-weight: 500;
}
[data-authio-widget] button.aw-btn:hover { border-color: var(--aw-accent); }
[data-authio-widget] button.aw-btn[data-variant="primary"] {
  background: var(--aw-accent); color: var(--aw-accent-fg); border-color: var(--aw-accent);
}
[data-authio-widget] button.aw-btn[data-variant="danger"] {
  background: var(--aw-danger); color: #ffffff; border-color: var(--aw-danger);
}
[data-authio-widget] button.aw-btn:disabled { opacity: 0.5; cursor: not-allowed; }
[data-authio-widget] table { width: 100%; border-collapse: collapse; }
[data-authio-widget] table th, [data-authio-widget] table td {
  padding: 8px 6px; text-align: left; border-bottom: 1px solid var(--aw-border); font-size: 13px;
}
[data-authio-widget] table th { color: var(--aw-muted); font-weight: 500; font-size: 12px; }
[data-authio-widget] .aw-row { display: flex; gap: 8px; align-items: center; }
[data-authio-widget] .aw-grid { display: grid; gap: 8px; }
[data-authio-widget] label { font-size: 12px; color: var(--aw-muted); display: block; margin-bottom: 4px; }
[data-authio-widget] input, [data-authio-widget] select, [data-authio-widget] textarea {
  width: 100%; height: 32px; border: 1px solid var(--aw-border); border-radius: 6px;
  padding: 0 10px; background: var(--aw-bg); color: var(--aw-fg); font-size: 13px; outline: none;
}
[data-authio-widget] textarea { height: auto; min-height: 80px; padding: 8px 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
[data-authio-widget] input:focus, [data-authio-widget] select:focus, [data-authio-widget] textarea:focus { border-color: var(--aw-accent); }
[data-authio-widget] .aw-pill {
  display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px;
  font-size: 11px; font-weight: 500;
  background: rgba(37, 99, 235, 0.08); color: var(--aw-accent);
}
[data-authio-widget] .aw-pill[data-tone="success"] { background: rgba(22, 163, 74, 0.1); color: var(--aw-success); }
[data-authio-widget] .aw-pill[data-tone="warn"] { background: rgba(217, 119, 6, 0.12); color: #d97706; }
[data-authio-widget] .aw-pill[data-tone="danger"] { background: rgba(220, 38, 38, 0.1); color: var(--aw-danger); }
[data-authio-widget] .aw-pill[data-tone="muted"] { background: var(--aw-border); color: var(--aw-muted); }
[data-authio-widget] .aw-error {
  border: 1px solid var(--aw-danger); background: rgba(220, 38, 38, 0.06);
  color: var(--aw-danger); border-radius: 6px; padding: 8px 12px; font-size: 13px;
}
[data-authio-widget] .aw-empty {
  border: 1px dashed var(--aw-border); border-radius: 6px;
  padding: 24px 12px; text-align: center; color: var(--aw-muted); font-size: 13px;
}
[data-authio-widget] .aw-spinner {
  display: inline-block; width: 14px; height: 14px;
  border: 2px solid var(--aw-border); border-top-color: var(--aw-accent);
  border-radius: 50%; animation: aw-spin 0.8s linear infinite;
}
@keyframes aw-spin { to { transform: rotate(360deg); } }
`;

let injected = false;

/**
 * Inject the widget stylesheet exactly once per document. Safe to
 * call from many widget instances — the second call is a no-op.
 */
export function ensureStylesInjected(doc: Document = document): void {
  if (injected) return;
  if (doc.getElementById("authio-widgets-styles")) {
    injected = true;
    return;
  }
  const style = doc.createElement("style");
  style.id = "authio-widgets-styles";
  style.textContent = WIDGET_CSS;
  doc.head.appendChild(style);
  injected = true;
}

// Test seam — the test setup resets the injection flag between
// cases so it can assert the stylesheet is present in the rendered
// DOM.
export const __testing = {
  reset() {
    injected = false;
  },
};
