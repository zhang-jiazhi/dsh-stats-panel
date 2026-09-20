/** Low-glare graphite surfaces with restrained blue data accents. */
export const dashboardCss = `
.dsp-root {
  --dsp-canvas: #10141b;
  --dsp-card: #181e28;
  --dsp-inset: #1e2734;
  --dsp-hover: #273448;
  --dsp-text: #e5ebf4;
  --dsp-text-2: #b6c1d2;
  --dsp-text-3: #929fb2;
  --dsp-border: #2c3645;
  --dsp-border-strong: #3c4b61;
  --dsp-accent: #91b0ed;
  --dsp-accent-fill: #91b0ed;
  --dsp-accent-hover: #b0c8f6;
  --dsp-on-accent: #14233d;
  --dsp-good: #83bfa9;
  --dsp-warn: #d1ac79;
  --dsp-bad: #e49292;
  --dsp-track: #283446;
  --dsp-c-input: #a8c0e6;
  --dsp-c-output: #c3d4ed;
  --dsp-c-cache: #5c7daf;
  --dsp-chart-main: #7f9ecb;
  --dsp-chart-1: #91b0ed;
  --dsp-chart-2: #7092c9;
  --dsp-chart-3: #5d7dab;
  --dsp-chart-4: #506b94;
  --dsp-chart-5: #435b7e;
  --dsp-chart-6: #394e6b;
  --dsp-chart-7: #32445c;
  --dsp-chart-8: #2d3c52;
  --dsp-feature-input: #f5f7fd;
  --dsp-feature-output: #9dcbbf;
  --dsp-feature-cache: #7396e3;
  --dsp-font: 'Avenir Next', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
  --dsp-numeric: 'Avenir Next', 'DIN Alternate', 'Bahnschrift', 'PingFang SC', sans-serif;
  --dsp-mono: 'SFMono-Regular', 'Cascadia Code', 'Menlo', 'Consolas', monospace;
  --dsp-tooltip-width: 224px;
  --dsp-tooltip-half: min(112px, 50%);
  color-scheme: dark;
  container: stats / inline-size;
  height: 100%; min-height: 0; min-width: 0; flex: 1 1 auto;
  overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
  background: radial-gradient(ellipse at 0 0, #1a2436 0, transparent 45%), var(--dsp-canvas);
  color: var(--dsp-text);
  font: 13px/1.5 var(--dsp-font);
  font-feature-settings: 'tnum' 1;
  -webkit-font-smoothing: antialiased;
  scrollbar-width: thin; scrollbar-color: var(--dsp-border-strong) transparent;
}
.dsp-root, .dsp-root *, .dsp-root *::before, .dsp-root *::after { box-sizing: border-box; }
/* Keep the view's scrollport and avoid chat drag handles intercepting controls. */
[data-slot="conversation.session"]:has(.dsp-root) > :has(> [data-slot="conversation.view"]) { flex: 1 1 0; min-height: 0; overflow: hidden; }
[data-slot="main.conversation"]:has(.dsp-root) [data-width-handle] { pointer-events: none; visibility: hidden; }
.dsp-frame { max-width: 1560px; margin: 0 auto; padding: 24px 26px 20px; }
.dsp-stack { display: flex; flex-direction: column; gap: 16px; }
.dsp-root button, .dsp-root input, .dsp-root select { font-family: inherit; font-size: inherit; }
.dsp-root button { -webkit-tap-highlight-color: transparent; }
.dsp-root :is(button, a, input, select, .dsp-bar-zone, summary):focus-visible { outline: 2px solid var(--dsp-accent); outline-offset: 3px; }
.dsp-header { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 18px; }
.dsp-header-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
.dsp-brand-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; background: #243750; border: 1px solid #3b557a; color: #b6cdf7; box-shadow: 0 3px 8px #00000020; flex: none; }
.dsp-brand-icon svg { width: 24px; height: 24px; }
.dsp-header-copy { min-width: 0; }
.dsp-report-mark { display: flex; align-items: center; gap: 8px; color: var(--dsp-text-3); font-size: 10px; font-weight: 600; letter-spacing: .09em; }
.dsp-report-mark > span { color: #52627b; }
.dsp-title { display: flex; align-items: center; gap: 12px; margin: 3px 0 0; font-size: 23px; font-weight: 600; line-height: 1.25; letter-spacing: 0; }
.dsp-scope-tag { font-size: 10px; font-weight: 400; letter-spacing: 0; color: var(--dsp-text-2); border: 1px solid var(--dsp-border-strong); border-radius: 5px; padding: 2px 6px; white-space: nowrap; }
.dsp-header-actions, .dsp-card-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.dsp-updated { display: inline-flex; gap: 7px; align-items: center; font-size: 11px; color: var(--dsp-text-3); white-space: nowrap; }
.dsp-live-dot, .dsp-status-dot { display: inline-block; flex: none; width: 5px; height: 5px; border-radius: 50%; background: var(--dsp-good); }
.dsp-live-dot { box-shadow: 0 0 0 3px #83bfa913; }
.dsp-head-error { font-size: 11px; color: var(--dsp-bad); max-width: 220px; overflow-wrap: anywhere; }
.dsp-context-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 11px; color: var(--dsp-text-3); margin-bottom: 12px; }
.dsp-context-items { display: flex; gap: 0; flex-wrap: wrap; }
.dsp-context-items > span + span { border-left: 1px solid var(--dsp-border-strong); margin-left: 12px; padding-left: 12px; }
.dsp-context-items b { font-family: var(--dsp-numeric); font-weight: 600; color: var(--dsp-text-2); }
.dsp-context-refresh { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.dsp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 32px; padding: 5px 11px; border: 1px solid var(--dsp-border-strong); border-radius: 7px; color: var(--dsp-text-2); background: var(--dsp-card); line-height: 1.5; font-size: 11px !important; font-weight: 500; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s; }
.dsp-btn:hover:not(:disabled) { background: var(--dsp-hover); border-color: #657c9f; color: var(--dsp-text); }
.dsp-btn:disabled, .dsp-seg-btn:disabled { opacity: .45; cursor: not-allowed; }
.dsp-btn-primary { background: var(--dsp-accent-fill); color: var(--dsp-on-accent); border-color: var(--dsp-accent-fill); box-shadow: 0 2px 3px #26354d12; }
.dsp-btn-primary:hover:not(:disabled) { background: var(--dsp-accent-hover); color: var(--dsp-on-accent); border-color: var(--dsp-accent-hover); }
.dsp-btn-quiet { background: transparent; border-color: transparent; color: var(--dsp-accent); }
.dsp-card { min-width: 0; background: var(--dsp-card); border: 1px solid var(--dsp-border); border-radius: 12px; padding: 16px 18px; box-shadow: 0 3px 12px #00000012; }
.dsp-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 30px; margin-bottom: 12px; flex-wrap: wrap; }
.dsp-card-title-wrap { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; min-width: 0; }
.dsp-card-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--dsp-text); margin: 0; line-height: 1.5; }
.dsp-card-hint, .dsp-inline-muted { font-size: 11px; color: var(--dsp-text-3); }
.dsp-count-badge { padding: 2px 7px; border-radius: 5px; background: var(--dsp-inset); color: var(--dsp-text-3); font-size: 10px; font-weight: 400; }
/* One blue-black anchor, four quiet metrics on a shared surface. */
.dsp-overview { display: grid; grid-template-columns: minmax(240px,1.25fr) minmax(0,4fr); gap: 14px; }
.dsp-feature-metric { position: relative; min-width: 0; overflow: hidden; display: flex; flex-direction: column; justify-content: center; padding: 16px 20px; border: 1px solid #385277; border-radius: 12px; background: linear-gradient(115deg, #203854, #19283d); color: #edf4ff; box-shadow: 0 5px 12px #00000018; }
.dsp-feature-metric::after { content: ''; position: absolute; width: 130px; height: 160px; right: -35px; top: -30px; transform: rotate(25deg); background: repeating-linear-gradient(90deg, transparent 0 19px, #ffffff05 19px 20px); pointer-events: none; }
.dsp-feature-label { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #cbd4e4; }
.dsp-feature-number { display: flex; align-items: baseline; gap: 5px; margin-top: 3px; font-family: var(--dsp-numeric); font-size: 46px; font-weight: 500; letter-spacing: -1.5px; line-height: 1.2; white-space: nowrap; }
.dsp-feature-unit { font-size: 25px; color: #9eb8f3; letter-spacing: -.5px; }
.dsp-composition { display: flex; gap: 2px; height: 3px; margin: 10px 0 9px; border-radius: 3px; overflow: hidden; background: #ffffff12; }
.dsp-composition > span { min-width: 0; height: 100%; border-radius: 1px; }
.dsp-feature-footer { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
.dsp-feature-footer > div { display: flex; flex-direction: column; gap: 1px; font-size: 10px; color: #aebdd4; }
.dsp-feature-footer strong { font-family: var(--dsp-numeric); font-size: 12px; font-weight: 500; color: #f4f7fd; }
.dsp-kpi-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); border: 1px solid var(--dsp-border); border-radius: 12px; background: var(--dsp-card); padding: 15px 0; }
.dsp-kpi { min-width: 0; padding: 1px 18px; display: flex; flex-direction: column; justify-content: center; }
.dsp-kpi + .dsp-kpi { border-left: 1px solid var(--dsp-border); }
.dsp-kpi-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dsp-kpi-label { font-size: 11px; color: var(--dsp-text-2); font-weight: 500; white-space: nowrap; }
.dsp-kpi-icon { display: flex; align-items: center; color: #8797b0; }
.dsp-kpi-value { margin-top: 11px; font-family: var(--dsp-numeric); font-size: clamp(23px, 2.25cqw, 32px); font-weight: 500; letter-spacing: -.8px; line-height: 1.2; white-space: nowrap; }
.dsp-kpi-caption, .dsp-kpi-chip { min-height: 19px; margin-top: 6px; font-size: 10px; color: var(--dsp-text-3); display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.dsp-kpi-sub { margin-top: 6px; font-size: 10px; color: var(--dsp-text-3); line-height: 1.6; overflow-wrap: anywhere; }
.dsp-kpi-meter { height: 4px; margin: 13px 0 8px; border-radius: 4px; background: var(--dsp-track); overflow: hidden; }
.dsp-kpi-meter span { height: 100%; display: block; border-radius: inherit; background: #81ae9e; }
.dsp-trend { display: inline-flex; align-items: center; gap: 2px; font-family: var(--dsp-numeric); font-size: 10px; color: #a7c1ed; padding: 0 4px; border-radius: 4px; background: #293b58; }
.dsp-charts { display: grid; grid-template-columns: minmax(0,1.85fr) minmax(0,1fr); gap: 16px; align-items: stretch; }
.dsp-trend-card, .dsp-share-card { display: flex; flex-direction: column; }
.dsp-seg { display: inline-flex; flex: none; gap: 2px; padding: 2px; border: 1px solid var(--dsp-border); border-radius: 7px; background: var(--dsp-inset); }
.dsp-seg-btn { border: 1px solid transparent; border-radius: 5px; padding: 4px 9px; min-height: 26px; background: transparent; color: var(--dsp-text-3); font-size: 11px !important; line-height: 1.4; cursor: pointer; white-space: nowrap; transition: color .15s, background .15s; }
.dsp-seg-btn:hover:not(:disabled) { color: var(--dsp-text); background: var(--dsp-hover); }
.dsp-seg-btn[aria-pressed="true"] { color: var(--dsp-accent); background: var(--dsp-card); border-color: var(--dsp-border); box-shadow: 0 1px 2px #22345108; }
.dsp-chart-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
.dsp-metric-switch { display: flex; gap: 12px; }
.dsp-metric-switch button { color: var(--dsp-text-3); background: none; border: 0; padding: 0 0 4px; border-bottom: 2px solid transparent; font-size: 11px; cursor: pointer; }
.dsp-metric-switch button[aria-pressed="true"] { color: var(--dsp-accent); border-color: var(--dsp-accent); font-weight: 500; }
.dsp-legend { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.dsp-legend-item { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; color: var(--dsp-text-3); }
.dsp-dot { display: inline-block; width: 6px; height: 6px; border-radius: 2px; flex: none; }
.dsp-plot { position: relative; min-height: 160px; flex: 1; }
.dsp-plot-grid { position: absolute; inset: 8px 0 24px 42px; border-bottom: 1px solid var(--dsp-border); }
.dsp-plot-line { position: absolute; left: 0; right: 0; height: 0; border-top: 1px dashed var(--dsp-border); }
.dsp-plot-line-label { position: absolute; right: calc(100% + 9px); top: -8px; font-size: 10px; color: var(--dsp-text-3); white-space: nowrap; font-family: var(--dsp-numeric); }
.dsp-bars { position: absolute; inset: 8px 0 24px 42px; display: flex; gap: 8px; }
.dsp-bar-col { position: relative; flex: 1; min-width: 0; display: flex; justify-content: center; }
.dsp-bar-zone { display: flex; flex-direction: column-reverse; width: 100%; max-width: 27px; height: 100%; border-radius: 4px 4px 0 0; cursor: crosshair; }
.dsp-bar-zone.is-hover { filter: brightness(1.2); background: #91b0ed0d; }
.dsp-bar-seg { width: 100%; flex-shrink: 0; }
.dsp-bar-seg:last-child { border-radius: 3px 3px 0 0; }
.dsp-bar-label { position: absolute; top: calc(100% + 6px); left: 50%; transform: translateX(-50%); color: var(--dsp-text-3); font-size: 9px; font-family: var(--dsp-numeric); white-space: nowrap; }
.dsp-tooltip { position: absolute; z-index: 5; top: 0; width: var(--dsp-tooltip-width); max-width: 100%; transform: translateX(-50%); padding: 12px 14px; border: 1px solid var(--dsp-border-strong); border-radius: 9px; background: #202b3c; color: var(--dsp-text-2); box-shadow: 0 8px 24px #00000055; font-size: 11px; pointer-events: none; }
.dsp-tooltip-title { font-weight: 600; margin-bottom: 6px; color: var(--dsp-text); }
.dsp-tooltip-row { display: flex; align-items: center; gap: 6px; padding: 3px 0; }
.dsp-tooltip-value { margin-left: auto; font-family: var(--dsp-numeric); font-weight: 500; }
.dsp-tooltip-total { margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--dsp-border); color: var(--dsp-text-3); }
.dsp-stat-strip { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); border-top: 1px solid var(--dsp-border); margin-top: 10px; padding-top: 10px; }
.dsp-stat { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsp-stat + .dsp-stat { padding-left: 16px; border-left: 1px solid var(--dsp-border); }
.dsp-stat-label { font-size: 10px; color: var(--dsp-text-3); }
.dsp-stat-value { font-family: var(--dsp-numeric); font-size: 17px; font-weight: 500; }
.dsp-chart-range { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 2px 12px; margin-top: 9px; color: var(--dsp-text-3); font-size: 9px; }
.dsp-notice { font-size: 11px; line-height: 1.6; color: var(--dsp-warn); margin-top: 10px; }
.dsp-share-summary { display: flex; justify-content: space-between; font-size: 10px; color: var(--dsp-text-3); margin: 2px 0 11px; }
.dsp-share-composition { display: flex; gap: 3px; height: 9px; border-radius: 4px; overflow: hidden; background: var(--dsp-track); margin-bottom: 12px; }
.dsp-share-composition span { min-width: 0; border-radius: 2px; }
.dsp-share-legend { display: flex; flex-direction: column; min-width: 0; }
.dsp-share-row { display: grid; grid-template-columns: minmax(0,1fr) 58px 44px; gap: 8px; align-items: center; padding: 8px 0; font-size: 11px; border-bottom: 1px solid #2c364580; }
.dsp-share-row:last-child { border-bottom: 0; }
.dsp-share-name { display: flex; align-items: center; gap: 7px; min-width: 0; color: var(--dsp-text-2); }
.dsp-share-name > span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 10px; }
.dsp-share-tokens { color: var(--dsp-text-3); text-align: right; font-family: var(--dsp-numeric); }
.dsp-share-pct { font-family: var(--dsp-numeric); font-weight: 600; text-align: right; }
.dsp-share-foot { display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; margin-top: auto; padding-top: 10px; color: var(--dsp-text-3); font-size: 9px; }
.dsp-filter-chips { display: flex; align-items: center; gap: 4px; }
.dsp-filter-chips button { background: transparent; border: 1px solid transparent; border-radius: 5px; padding: 3px 7px; color: var(--dsp-text-3); font-size: 10px; cursor: pointer; }
.dsp-filter-chips button[aria-pressed="true"] { background: #29384e; border-color: #3b4e6b; color: #aac3ee; }
.dsp-filter-chips b { font-weight: 500; margin-left: 3px; font-family: var(--dsp-numeric); }
.dsp-balance-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; align-items: stretch; }
.dsp-balance { display: flex; flex-direction: column; min-width: 0; padding: 13px 14px; min-height: 126px; background: linear-gradient(120deg, #1e2837, #1b222e); border: 1px solid var(--dsp-border); border-radius: 9px; }
.dsp-balance.is-error { background: #2a2426; border-color: #594047; }
.dsp-balance-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsp-channel-symbol { width: 25px; height: 25px; flex: none; display: grid; place-items: center; background: #283951; border: 1px solid #3d5476; border-radius: 7px; color: #abc4e9; font-family: var(--dsp-numeric); font-size: 12px; font-weight: 600; }
.dsp-balance-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dsp-text-2); font-size: 11px; font-weight: 500; }
.dsp-badge { display: inline-flex; align-items: center; gap: 4px; flex: none; margin-left: auto; font-size: 9px; color: var(--dsp-text-3); }
.dsp-balance-body { margin-top: 12px; flex: 1; min-width: 0; }
.dsp-balance-value { font-family: var(--dsp-numeric); font-size: 25px; line-height: 1.2; font-weight: 500; letter-spacing: -.5px; overflow-wrap: anywhere; }
.dsp-balance-note, .dsp-balance-foot, .dsp-quota-foot { font-size: 10px; color: var(--dsp-text-3); line-height: 1.6; overflow-wrap: anywhere; }
.dsp-balance-note { margin-top: 5px; }
.dsp-balance-foot { margin-top: 10px; }
.dsp-balance-error { font-size: 11px; color: var(--dsp-text-2); overflow-wrap: anywhere; line-height: 1.6; }
.dsp-error-details summary { font-size: 11px; color: var(--dsp-bad); cursor: pointer; }
.dsp-error-details[open] summary { margin-bottom: 6px; }
.dsp-quotas { display: flex; gap: 16px; }
.dsp-quota { flex: 1; min-width: 0; }
.dsp-quota-top { display: flex; justify-content: space-between; gap: 6px; align-items: center; font-size: 10px; }
.dsp-quota-label { color: var(--dsp-text-2); }
.dsp-quota-pct { font-family: var(--dsp-numeric); font-weight: 500; font-size: 12px; }
.dsp-quota-track { height: 4px; border-radius: 4px; background: #354255; overflow: hidden; margin: 7px 0 5px; }
.dsp-quota-fill { display: block; height: 100%; border-radius: inherit; }
.dsp-manual { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dsp-manual-value { font-size: 11px; color: var(--dsp-text-2); overflow-wrap: anywhere; }
.dsp-manual-actions { display: flex; gap: 6px; margin-top: 8px; }
.dsp-input { display: block; width: 100%; min-width: 0; min-height: 32px; border: 1px solid var(--dsp-border-strong); border-radius: 5px; background: var(--dsp-card); color: var(--dsp-text); padding: 5px 8px; font-size: 12px !important; }
.dsp-expand-row { display: flex; align-items: center; justify-content: center; gap: 14px; padding-top: 10px; color: var(--dsp-text-3); font-size: 10px; }
.dsp-details-card > .dsp-card-head { margin-bottom: 14px; }
.dsp-detail-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px 16px; padding-bottom: 12px; border-bottom: 1px solid var(--dsp-border); }
.dsp-detail-tabs { display: flex; align-items: center; gap: 4px; }
.dsp-detail-tabs .dsp-seg-btn { padding: 6px 10px; min-height: 32px; }
.dsp-detail-tabs .dsp-seg-btn[aria-pressed="true"] { background: #293b58; border-color: #3c5274; box-shadow: none; }
.dsp-detail-controls { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsp-search { display: flex; align-items: center; gap: 7px; width: 182px; min-width: 0; height: 32px; padding: 0 9px; border: 1px solid var(--dsp-border); border-radius: 6px; color: var(--dsp-text-3); background: var(--dsp-card); }
.dsp-search:focus-within { border-color: var(--dsp-accent); }
.dsp-search svg { flex: none; }
.dsp-search input { width: 100%; min-width: 0; height: 100%; padding: 0; border: 0; background: none; color: var(--dsp-text); font-size: 11px; }
.dsp-search input:focus-visible { outline: 0; }
.dsp-search input::placeholder { color: var(--dsp-text-3); }
.dsp-select { min-width: 0; height: 32px; border: 1px solid var(--dsp-border); border-radius: 6px; padding: 0 8px; background: var(--dsp-card); color: var(--dsp-text-2); font-size: 11px !important; cursor: pointer; }
.dsp-detail-context { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; min-height: 38px; padding: 8px 0; color: var(--dsp-text-3); font-size: 10px; }
.dsp-table-head, .dsp-row { display: grid; grid-template-columns: minmax(0,1fr) 130px 90px 106px; align-items: center; gap: 18px; }
.dsp-table-head { color: var(--dsp-text-3); padding: 9px 10px; background: var(--dsp-inset); border-radius: 5px; font-size: 10px; }
.dsp-table-head span:not(:first-child) { text-align: right; }
.dsp-row { padding: 12px 10px; min-width: 0; border-bottom: 1px solid var(--dsp-border); }
.dsp-row:last-child { border-bottom: 0; }
.dsp-row:hover, .dsp-record:hover { background: #28374b66; }
.dsp-row-main, .dsp-record-main { min-width: 0; }
.dsp-row-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.dsp-row-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsp-mono); font-size: 11px; font-weight: 500; color: var(--dsp-text); }
.dsp-rank { min-width: 20px; color: #91a0b7; font-family: var(--dsp-mono); font-size: 10px; }
.dsp-row-sub, .dsp-record-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 2px 6px; margin-top: 4px; font-size: 10px; color: var(--dsp-text-3); }
.dsp-row-sub { padding-left: 28px; }
.dsp-sep { color: #5c6e89; }
.dsp-row-models { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 9px; }
.dsp-row-share { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; }
.dsp-track { flex: 1; height: 4px; border-radius: 3px; background: var(--dsp-track); overflow: hidden; }
.dsp-track-pct { width: 42px; color: var(--dsp-text-2); text-align: right; font-family: var(--dsp-numeric); font-size: 11px; }
.dsp-metric { display: flex; flex-direction: column; align-items: flex-end; min-width: 0; gap: 3px; }
.dsp-metric-value { font-family: var(--dsp-numeric); font-size: 13px; font-weight: 500; white-space: nowrap; }
.dsp-metric-label { font-size: 9px; color: var(--dsp-text-3); }
.dsp-rows .dsp-metric-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.dsp-metric.is-cost .dsp-metric-value { color: var(--dsp-text-2); }
.dsp-tag { display: inline-flex; padding: 1px 5px; border-radius: 4px; border: 1px solid var(--dsp-border); color: var(--dsp-text-3); font-size: 9px; line-height: 1.5; }
.dsp-tag.is-warn { color: var(--dsp-warn); background: #342c23; border-color: #5b4934; white-space: nowrap; }
.dsp-records { min-width: 0; }
.dsp-record { display: grid; grid-template-columns: 112px minmax(0,1fr) 90px 106px; gap: 18px; align-items: center; border-bottom: 1px solid var(--dsp-border); padding: 10px; }
.dsp-record:last-child { border-bottom: 0; }
.dsp-record-time { font-family: var(--dsp-mono); font-size: 10px; color: var(--dsp-text-3); }
.dsp-record-model { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--dsp-mono); font-size: 11px; font-weight: 500; }
.dsp-pricing-note { font-size: 11px; color: var(--dsp-text-3); padding: 7px 10px; background: var(--dsp-inset); border-radius: 5px; margin-bottom: 4px; }
.dsp-pricing-note summary { cursor: pointer; }
.dsp-hint { max-width: 100ch; margin: 10px 0 4px; font-size: 11px; color: var(--dsp-text-3); line-height: 1.8; }
.dsp-price-row { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 12px 10px; border-bottom: 1px solid var(--dsp-border); }
.dsp-price-row:last-child { border-bottom: 0; }
.dsp-price-model { flex: 1 1 240px; min-width: 0; font-family: var(--dsp-mono); font-size: 11px; color: var(--dsp-text); overflow-wrap: anywhere; }
.dsp-price-fields { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); flex: 2 1 440px; min-width: 0; gap: 16px; }
.dsp-price-cell { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dsp-price-label { font-size: 10px; color: var(--dsp-text-3); }
.dsp-price-value { font-family: var(--dsp-numeric); font-size: 13px; color: var(--dsp-text-2); }
.dsp-pagination { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--dsp-border); color: var(--dsp-text-3); font-size: 10px; }
.dsp-pagination > div { display: flex; align-items: center; gap: 12px; }
.dsp-pagination .dsp-btn { min-height: 28px; padding: 3px 8px; font-size: 10px !important; }
.dsp-link { color: var(--dsp-accent); text-decoration: none; }
.dsp-link:hover { text-decoration: underline; }
.dsp-error { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin: 0; color: var(--dsp-bad); font-size: 12px; }
.dsp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 32px 16px; text-align: center; font-size: 12px; color: var(--dsp-text-3); }
.dsp-empty > svg { width: 22px; height: 22px; color: #96a4bb; margin-bottom: 4px; }
.dsp-empty strong { color: var(--dsp-text-2); font-weight: 500; }
.dsp-footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; font-size: 10px; color: var(--dsp-text-3); padding: 0 2px; }
.dsp-skel { border-radius: 10px; background: linear-gradient(100deg, #202b3b 30%, #2d3c53 50%, #202b3b 70%); background-size: 240% 100%; animation: dspShimmer 1.8s ease-in-out infinite; }
.dsp-spin { animation: dspSpin .9s linear infinite; }
.dsp-fade > :is(.dsp-overview, .dsp-charts, .dsp-balances-card, .dsp-details-card) { animation: dspEnter .28s both; }
.dsp-fade > .dsp-charts { animation-delay: .04s; }
.dsp-fade > .dsp-balances-card { animation-delay: .08s; }
.dsp-fade > .dsp-details-card { animation-delay: .12s; }
@keyframes dspSpin { to { transform: rotate(360deg); } }
@keyframes dspShimmer { from { background-position: 150% 0; } to { background-position: -150% 0; } }
@keyframes dspEnter { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@container stats (max-width: 1120px) {
  .dsp-frame { padding: 20px; }
  .dsp-kpi { padding-inline: 12px; }
  .dsp-kpi-value { font-size: 25px; }
  .dsp-overview { grid-template-columns: minmax(215px,1.15fr) minmax(0,4fr); }
  .dsp-charts { grid-template-columns: minmax(0,1.65fr) minmax(0,1fr); }
  .dsp-bars { gap: 5px; }
  .dsp-bar-col:nth-child(even):not(:last-child) .dsp-bar-label { visibility: hidden; }
  .dsp-balance-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .dsp-detail-controls { flex: 1; justify-content: flex-end; }
  .dsp-table-head, .dsp-row { grid-template-columns: minmax(0,1fr) 106px 78px 94px; gap: 12px; }
}
@container stats (max-width: 940px) {
  .dsp-overview { grid-template-columns: minmax(0,1fr) minmax(0,1.7fr); }
  .dsp-kpi-grid { grid-template-columns: repeat(2,minmax(0,1fr)); padding: 0; }
  .dsp-kpi { padding: 13px 16px; }
  .dsp-kpi:nth-child(3) { border-left: 0; }
  .dsp-kpi:nth-child(n+3) { border-top: 1px solid var(--dsp-border); }
  .dsp-kpi-value { margin-top: 7px; font-size: 25px; }
  .dsp-kpi-caption, .dsp-kpi-chip { margin-top: 3px; min-height: 16px; }
  .dsp-kpi-sub { margin-top: 3px; }
  .dsp-feature-number { font-size: 54px; margin-block: 12px; }
  .dsp-charts { grid-template-columns: minmax(0,1.5fr) minmax(0,1fr); }
  .dsp-share-row { grid-template-columns: minmax(0,1fr) 50px 38px; gap: 4px; }
  .dsp-share-name { gap: 5px; }
  .dsp-share-name > span:last-child { font-size: 9px; }
  .dsp-chart-range { font-size: 9px; }
  .dsp-detail-controls { flex-basis: 100%; justify-content: stretch; }
  .dsp-search { flex: 1; }
}
@container stats (max-width: 720px) {
  .dsp-frame { padding: 18px 16px; }
  .dsp-header { gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .dsp-header-actions { margin-left: auto; }
  .dsp-title { font-size: 21px; }
  .dsp-context-refresh { display: none; }
  .dsp-charts { grid-template-columns: minmax(0,1fr); }
  .dsp-plot { min-height: 180px; }
  .dsp-share-row { grid-template-columns: minmax(0,1fr) 64px 48px; }
  .dsp-share-name > span:last-child { font-size: 11px; }
  .dsp-share-foot { margin-top: 8px; }
  .dsp-table-head, .dsp-row { grid-template-columns: minmax(0,1fr) 72px 84px; }
  .dsp-table-head { display: none; }
  .dsp-row { row-gap: 7px; }
  .dsp-row-share { grid-column: 1; grid-row: 2; padding-left: 28px; }
  .dsp-row .dsp-metric:nth-child(3) { grid-column: 2; grid-row: 1/3; }
  .dsp-row .dsp-metric:nth-child(4) { grid-column: 3; grid-row: 1/3; }
  .dsp-rows .dsp-metric-label { position: static; width: auto; height: auto; overflow: visible; clip-path: none; }
  .dsp-record { grid-template-columns: minmax(0,1fr) 72px 84px; gap: 6px 12px; }
  .dsp-record-time { grid-column: 1/-1; }
  .dsp-row-title { flex-wrap: wrap; gap: 4px 8px; }
  .dsp-row-name { flex: 1; }
  .dsp-row-title .dsp-tag { margin-left: 28px; }
  .dsp-quotas { flex-direction: column; gap: 10px; }
}
@container stats (max-width: 520px) {
  .dsp-frame { padding: 16px 12px; }
  .dsp-stack { gap: 12px; }
  .dsp-header-actions { width: 100%; justify-content: space-between; }
  .dsp-title { font-size: 21px; }
  .dsp-scope-tag { font-size: 9px; }
  .dsp-context-items { font-size: 10px; }
  .dsp-context-items > span + span { margin-left: 8px; padding-left: 8px; }
  .dsp-overview { grid-template-columns: minmax(0,1fr); gap: 10px; }
  .dsp-feature-metric { padding: 15px 18px; }
  .dsp-feature-number { font-size: 46px; margin: 5px 0 0; }
  .dsp-feature-footer { grid-template-columns: repeat(3,minmax(0,1fr)); }
  .dsp-kpi { padding: 13px 14px; }
  .dsp-kpi-value { font-size: 27px; }
  .dsp-card { padding: 14px; border-radius: 10px; }
  .dsp-card-title-wrap { gap: 8px; }
  .dsp-balance-grid { grid-template-columns: minmax(0,1fr); }
  .dsp-balance { min-height: 115px; }
  .dsp-quotas { flex-direction: row; }
  .dsp-card-head { gap: 10px; }
  .dsp-balances-card .dsp-card-head > .dsp-card-title-wrap { flex: 1; }
  .dsp-balances-card .dsp-card-title { flex-basis: 100%; }
  .dsp-detail-toolbar { gap: 10px; }
  .dsp-detail-tabs { width: 100%; justify-content: space-between; gap: 0; }
  .dsp-detail-tabs .dsp-seg-btn { padding-inline: 7px; }
  .dsp-detail-controls { gap: 6px; }
  .dsp-select { max-width: 132px; padding-inline: 4px; }
  .dsp-detail-context { font-size: 9px; }
  .dsp-row, .dsp-record { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 8px 12px; padding: 13px 2px; }
  .dsp-row-main, .dsp-record-main { grid-column: 1/-1; }
  .dsp-row-share { grid-column: 1/-1; grid-row: auto; padding-left: 28px; }
  .dsp-row .dsp-metric:nth-child(3), .dsp-row .dsp-metric:nth-child(4) { grid-column: auto; grid-row: auto; align-items: flex-start; }
  .dsp-row .dsp-metric:nth-child(3) { padding-left: 28px; }
  .dsp-record .dsp-metric { align-items: flex-start; }
  .dsp-metric-value { font-size: 14px; }
  .dsp-price-row { padding-inline: 0; gap: 10px; }
  .dsp-price-fields { flex-basis: 100%; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px 14px; }
  .dsp-pagination { gap: 8px; flex-wrap: wrap; }
  .dsp-pagination > div { gap: 8px; }
  .dsp-pagination .dsp-btn { min-height: 32px; }
  .dsp-footer { font-size: 9px; }
  .dsp-btn { min-height: 36px; }
  .dsp-seg-btn { min-height: 30px; }
}
@container stats (max-width: 340px) {
  .dsp-scope-tag { display: none; }
  .dsp-context-items > span:last-child { display: none; }
  .dsp-card { padding: 12px; }
  .dsp-card-title { font-size: 12px; }
  .dsp-kpi-value { font-size: 23px; }
  .dsp-kpi { padding-inline: 10px; }
  .dsp-detail-tabs { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 4px; }
  .dsp-detail-tabs .dsp-seg-btn { padding-inline: 5px; font-size: 10px !important; }
  .dsp-count-badge { display: none; }
  .dsp-chart-toolbar { gap: 6px; }
  .dsp-legend { gap: 8px; }
  .dsp-chart-range { font-size: 8px; }
}
@media (prefers-reduced-motion: reduce) {
  .dsp-root *, .dsp-root *::before, .dsp-root *::after { animation: none !important; transition: none !important; }
}
`
