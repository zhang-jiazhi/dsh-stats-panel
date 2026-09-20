window.__ModuleLoader__.load({
	id: "@linxin666/dsh-stats-panel",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/dashboard-theme.ts
		/** Low-glare graphite surfaces with restrained blue data accents. */
		const dashboardCss = `
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
`;
		//#endregion
		//#region src/client/dashboard-data.ts
		/** Match all terms, including terms split across model and channel. */
		function matchesQuery(query, ...values) {
			const haystack = values.join(" ").toLowerCase();
			return query.trim().toLowerCase().split(/\s+/).every((term) => haystack.includes(term));
		}
		function rankUsage(rows, sort) {
			const key = sort === "calls" ? "calls" : "totalTokens";
			return [...rows].sort((a, b) => b[key] - a[key]);
		}
		/** Preserve exact values and prevent model names from becoming spreadsheet formulas. */
		function usageCsv(headers, rows) {
			const cell = (value) => {
				const text = String(value);
				return `"${(typeof value === "string" && /^\s*[=+\-@]/u.test(text) ? `'${text}` : text).replace(/"/g, "\"\"")}"`;
			};
			return "﻿" + [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
		}
		//#endregion
		//#region src/client/stats-panel.tsx
		/**
		* Token usage dashboard for the dsh web GUI — a `conversation.view` tab.
		*
		* Data flow (it is a passive board, so reads are deliberately lazy): on mount
		* it repaints the last page-session payload (stale-while-revalidate), fetches
		* `/api/stats-panel/summary` (host half), and silently re-polls every 60 s
		* only while the page is visible. Sections are memoized and an unchanged
		* payload keeps the old object references, so a poll with no new usage costs
		* one header-clock re-render. Balances re-probe at most every 2 min on the
		* client (the host caches probe rounds for 60 s and dedupes concurrent ones).
		* The price table stays editable and persists in localStorage; defaults are
		* DeepSeek's official CNY peak-hour prices effective 2026-08-29 (source:
		* https://api-docs.deepseek.com/zh-cn/quick_start/pricing).
		*
		* Scroll ownership: the shell renders every view tab inside one shared
		* conversation scrollport whose chat half is pinned to the bottom. This view
		* resets that scrollport to the top on mount and — via the `:has()` rules in
		* {@link dashboardCss} — becomes its own scrollport, so the shared one never
		* scrolls while the dashboard is active.
		*
		* All rendering is contained: any fetch/render failure renders an inline
		* error card instead of throwing out of the view.
		*/
		/** Whether an async response still belongs to the active, non-aborted request. */
		function isCurrentRequest(requestId, currentId, aborted) {
			return requestId === currentId && !aborted;
		}
		const SUMMARY_URL = "/api/stats-panel/summary";
		const BALANCES_URL = "/api/stats-panel/balances";
		/** Auto-refresh interval while the tab is mounted (ms). */
		const REFRESH_MS = 6e4;
		/**
		* Client-side staleness threshold for auto balance reloads (ms). Probes hit
		* real provider account APIs, so the poll cadence for them is deliberately
		* slower than the usage summary; the refresh button bypasses it.
		*/
		const BALANCES_TTL_MS = 12e4;
		/** localStorage key for manually entered plan quotas (v1). */
		const MANUAL_QUOTA_KEY = "dsh-stats-panel:manual-quota:v1";
		/** provider id → friendly channel name. */
		const CHANNEL_NAMES = {
			"deepseek-official": "DeepSeek 官方",
			"opencode-go": "OpenCode Go 套餐",
			"opencode-go-bridge": "OpenCode Go 套餐",
			mimo: "小米 MiMo Token Plan",
			openai: "OpenAI",
			anthropic: "Anthropic",
			moonshot: "Kimi 月之暗面",
			kimi: "Kimi 月之暗面",
			siliconflow: "硅基流动",
			stepfun: "阶跃星辰 StepFun",
			openrouter: "OpenRouter",
			novita: "Novita AI",
			unknown: "未知渠道"
		};
		function channelName(channel) {
			return CHANNEL_NAMES[channel] ?? channel;
		}
		/** localStorage key for the editable price table (v2 = CNY). */
		const PRICES_KEY = "dsh-stats-panel:prices:v2";
		/**
		* 内置默认价格表，人民币 元/1M tokens（用户可在「模型价格」分页覆盖，
		* 存 localStorage；与本表按模型合并——改过的条目以用户为准）。
		*
		* 来源（2026-08-29 官方定价页原文核对）：
		* - DeepSeek 官方 api-docs.deepseek.com：峰谷计价（高峰 = 周一至五 9-12/14-18 时，
		*   空闲减半，缓存写免费）。此处按高峰口径——统计多为工作时段调用：
		*   flash 3/9（缓存命中 0.1）、pro 9/27（缓存命中 0.3）
		* - OpenAI GPT-5.6 developers.openai.com/api/docs/pricing Standard 短上下文
		*   （sol 促销价至 2026-11-21；缓存读 $0.4/缓存写 $5；luna $0.2/$0.02/$0.25/$1.2），
		*   美元按 ≈7.1 汇率折算
		* - Anthropic Claude Opus 5（$5/$25；缓存读 0.1×、缓存写 1.25× 输入价）
		* - 智谱 bigmodel.cn 定价页（glm-5.3-flash 0.002 元/千 tokens；缓存读按输入价
		*   10% 估算，官方未单列）
		* - Kimi platform.kimi.com（k2.7-code：输入 6.5 / 输出 27 / 缓存命中 1.3）
		* - 套餐内（MiMo Token Plan）与免费模型计 0，避免与套餐/免费额度重复计费
		*/
		const DEFAULT_PRICES = {
			"deepseek-v4-flash": {
				inputPerM: 3,
				outputPerM: 9,
				cacheReadPerM: .1,
				cacheWritePerM: 0
			},
			"deepseek-v4-flash-0731": {
				inputPerM: 3,
				outputPerM: 9,
				cacheReadPerM: .1,
				cacheWritePerM: 0
			},
			"deepseek-v4-flash-vision-exp": {
				inputPerM: 3,
				outputPerM: 9,
				cacheReadPerM: .1,
				cacheWritePerM: 0
			},
			"deepseek-v4f": {
				inputPerM: 3,
				outputPerM: 9,
				cacheReadPerM: .1,
				cacheWritePerM: 0
			},
			"deepseek-v4-pro": {
				inputPerM: 9,
				outputPerM: 27,
				cacheReadPerM: .3,
				cacheWritePerM: 0
			},
			"deepseek-v4-pro-0813": {
				inputPerM: 9,
				outputPerM: 27,
				cacheReadPerM: .3,
				cacheWritePerM: 0
			},
			"gpt-5.6-sol": {
				inputPerM: 28.4,
				outputPerM: 142,
				cacheReadPerM: 2.84,
				cacheWritePerM: 35.5
			},
			"gpt-5.6-luna": {
				inputPerM: 1.42,
				outputPerM: 8.52,
				cacheReadPerM: .142,
				cacheWritePerM: 1.78
			},
			"claude-opus-5": {
				inputPerM: 35.5,
				outputPerM: 177.5,
				cacheReadPerM: 3.55,
				cacheWritePerM: 44.4
			},
			"glm-5.3-flash": {
				inputPerM: 2,
				outputPerM: 2,
				cacheReadPerM: .2,
				cacheWritePerM: 0
			},
			"kimi-k2.7-code": {
				inputPerM: 6.5,
				outputPerM: 27,
				cacheReadPerM: 1.3,
				cacheWritePerM: 0
			},
			"mimo-v2.5-pro": {
				inputPerM: 0,
				outputPerM: 0,
				cacheReadPerM: 0,
				cacheWritePerM: 0
			},
			"ox-alpha-free": {
				inputPerM: 0,
				outputPerM: 0,
				cacheReadPerM: 0,
				cacheWritePerM: 0
			},
			"muse-spark-1.2-contributor": {
				inputPerM: 0,
				outputPerM: 0,
				cacheReadPerM: 0,
				cacheWritePerM: 0
			},
			"unknown": {
				inputPerM: 0,
				outputPerM: 0,
				cacheReadPerM: 0,
				cacheWritePerM: 0
			}
		};
		/**
		* Chart palette — deliberately desaturated so it sits calmly on both the warm
		* dark skin and the default themes; the UI accent (theme business primary) is
		* reserved for interactive chrome, never for data series.
		*/
		const COLOR_INPUT = "var(--dsp-c-input)";
		const COLOR_OUTPUT = "var(--dsp-c-output)";
		const COLOR_CACHE = "var(--dsp-c-cache)";
		const CHART_COLORS = Array.from({ length: 8 }, (_, i) => `var(--dsp-chart-${i + 1})`);
		/**
		* Compact token count: K / M / B tiers (1B = 1000M, matching the billing
		* convention), with decimals collapsing as magnitude grows — 7.51M,
		* 183.5M, 3.20B, 500M.
		*/
		function formatTokens(tokens) {
			const abs = Math.abs(tokens);
			if (abs >= 1e9) return `${compactNum(tokens / 1e9)}B`;
			if (abs >= 1e6) return `${compactNum(tokens / 1e6)}M`;
			if (abs >= 1e3) return `${compactNum(tokens / 1e3)}K`;
			return String(Math.round(tokens));
		}
		/** <10 → 2 位小数，<100 → 1 位，其余取整（图表轴与卡片数值共用）。 */
		function compactNum(value) {
			const abs = Math.abs(value);
			if (abs >= 100) return value.toFixed(0);
			if (abs >= 10) return value.toFixed(1);
			return value.toFixed(2);
		}
		/**
		* Short axis label for one bucket key. Parses the key's own text instead of
		* `new Date(key)`: only the daily `YYYY-MM-DD` form is a valid date string —
		* `2026-W34` is not, and bare `2026-08` would be read as UTC midnight and could
		* render as the previous month in a negative-offset timezone.
		*/
		function formatBucketLabel(key, period) {
			if (period === "week") return `W${key.slice(6)}`;
			if (period === "month") return `${Number(key.slice(5, 7))}月`;
			const [, month, day] = key.split("-");
			return `${Number(month)}/${Number(day)}`;
		}
		function formatCny(cny) {
			if (cny === 0) return "¥0.00";
			if (cny < .01) return `¥${cny.toFixed(4)}`;
			if (cny < 1) return `¥${cny.toFixed(3)}`;
			return `¥${cny.toFixed(2)}`;
		}
		/** Compact `MM-DD HH:mm:ss` for the records list (stable across locales). */
		function formatRecordTime(ts) {
			const d = new Date(ts);
			const pad = (n) => String(n).padStart(2, "0");
			return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
		}
		/** Cost of one model's usage under a price entry, CNY. */
		function modelCost(stat, price) {
			if (price === void 0) return 0;
			return stat.inputTokens / 1e6 * price.inputPerM + stat.outputTokens / 1e6 * price.outputPerM + stat.cacheReadTokens / 1e6 * price.cacheReadPerM + stat.cacheWriteTokens / 1e6 * price.cacheWritePerM;
		}
		function loadPrices() {
			const stored = {};
			try {
				const raw = window.localStorage.getItem(PRICES_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					for (const [model, price] of Object.entries(parsed)) {
						if (price === null || typeof price !== "object") continue;
						stored[model] = {
							inputPerM: Number(price.inputPerM) || 0,
							outputPerM: Number(price.outputPerM) || 0,
							cacheReadPerM: Number(price.cacheReadPerM) || 0,
							cacheWritePerM: Number(price.cacheWritePerM) || 0
						};
					}
				}
			} catch {}
			return {
				...DEFAULT_PRICES,
				...stored
			};
		}
		function savePrices(prices) {
			try {
				window.localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
			} catch {}
		}
		function loadManualQuota() {
			try {
				const raw = window.localStorage.getItem(MANUAL_QUOTA_KEY);
				if (raw === null) return {};
				const parsed = JSON.parse(raw);
				const out = {};
				for (const [channel, note] of Object.entries(parsed)) if (typeof note === "string") out[channel] = note;
				return out;
			} catch {
				return {};
			}
		}
		/**
		* Page-session caches for stale-while-revalidate: re-entering the tab
		* repaints the last payload instantly, then revalidates in the background.
		* Memory-only — a page reload refetches; nothing stale survives a restart.
		*/
		let summaryMemo = null;
		let balancesMemo = null;
		/**
		* Payload compare for the auto-refresh: an unchanged response keeps the old
		* object reference so the memoized sections skip re-rendering entirely.
		* Cheap scalar comparison instead of stringifying the whole payload (the
		* round-1 audit found a full JSON.stringify running every 60s poll): totals
		* (and the derived hit rate) detect any new or re-folded usage, the bucket
		* clock and notice detect calendar rollovers, and the per-dimension counts
		* detect structural changes (a new model/channel, an adopted archive). Usage
		* records only ever accumulate, so two changes that cancel inside those
		* scalars without moving another do not occur in practice.
		*/
		function sameSummary(a, b) {
			if (a === null) return false;
			return a.totalCalls === b.totalCalls && a.totalInputTokens === b.totalInputTokens && a.totalOutputTokens === b.totalOutputTokens && a.totalCacheReadTokens === b.totalCacheReadTokens && a.totalCacheWriteTokens === b.totalCacheWriteTokens && a.totalReasoningTokens === b.totalReasoningTokens && a.totalTokens === b.totalTokens && a.cacheHitRate === b.cacheHitRate && a.dayKeyNow === b.dayKeyNow && a.bucketOffsetMinutes === b.bucketOffsetMinutes && a.bucketNotice === b.bucketNotice && a.modelStats.length === b.modelStats.length && a.channelStats.length === b.channelStats.length && a.dailyStats.length === b.dailyStats.length && a.weeklyStats.length === b.weeklyStats.length && a.monthlyStats.length === b.monthlyStats.length && a.recentRecords.length === b.recentRecords.length;
		}
		/** Today's UTC bucket key — matches the host's `toISOString` day bucketing. */
		function utcDayKey() {
			return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
		}
		/** Minimal stroke icons for the KPI chips (16×16 grid, currentColor-free). */
		function IconPulse({ color }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: 15,
				height: 15,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M1.5 8h2.6l2-4.6 3 9.2 2-4.6h3.4",
					stroke: color,
					strokeWidth: 1.5,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function IconLayers({ color }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 15,
				height: 15,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z",
					stroke: color,
					strokeWidth: 1.4,
					strokeLinejoin: "round"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M2.5 8.4 8 11.2l5.5-2.8M2.5 11.4 8 14.2l5.5-2.8",
					stroke: color,
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function IconClock({ color }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 15,
				height: 15,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 6.2,
					stroke: color,
					strokeWidth: 1.4
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 4.6V8l2.4 1.6",
					stroke: color,
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function IconTarget({ color }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 15,
				height: 15,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 6.2,
					stroke: color,
					strokeWidth: 1.4
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 2.6,
					stroke: color,
					strokeWidth: 1.4
				})]
			});
		}
		function IconCoin({ color }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: 15,
				height: 15,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 6.2,
					stroke: color,
					strokeWidth: 1.4
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M5.6 4.8 8 7.6l2.4-2.8M8 7.6v3.8M6.2 9.4h3.6M6.2 11h3.6",
					stroke: color,
					strokeWidth: 1.2,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function IconSearch() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				width: "15",
				height: "15",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "6.8",
					cy: "6.8",
					r: "4.5",
					stroke: "currentColor",
					strokeWidth: "1.4"
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "m10.2 10.2 3.4 3.4",
					stroke: "currentColor",
					strokeWidth: "1.4",
					strokeLinecap: "round"
				})]
			});
		}
		function IconDownload() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				width: "15",
				height: "15",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M8 2v8m-3-3 3 3 3-3M2.5 10.5v3h11v-3",
					stroke: "currentColor",
					strokeWidth: "1.4",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function downloadCsv(content, name) {
			const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
			const link = document.createElement("a");
			link.href = url;
			link.download = name;
			link.click();
			window.setTimeout(() => {
				URL.revokeObjectURL(url);
			}, 1e3);
		}
		/**
		* Containment ring around the whole dashboard: a render bug in one card must
		* degrade to an inline error card, never unmount the GUI's view slot.
		*/
		var DashboardBoundary = class extends react.Component {
			state = { error: null };
			static getDerivedStateFromError(e) {
				return { error: e instanceof Error ? e.message : String(e) };
			}
			render() {
				if (this.state.error !== null) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsp-card",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
						className: "dsp-error",
						role: "status",
						children: ["统计面板渲染出错：", this.state.error]
					})
				});
				return this.props.children;
			}
		};
		/**
		* The conversation-view tab body: full-width dashboard. Paints the last
		* page-session payload instantly, then revalidates; auto-refreshes every
		* {@link REFRESH_MS} while the tab is visible. Owns the price table so the
		* cost KPI and the cost columns always agree.
		*/
		function StatsView() {
			const [stats, setStats] = (0, react.useState)(() => summaryMemo?.data ?? null);
			const [error, setError] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(() => summaryMemo === null);
			const [updatedAt, setUpdatedAt] = (0, react.useState)(() => summaryMemo?.at ?? null);
			/** Bumped by the refresh button / timer; channel cards reload on change. */
			const [refreshKey, setRefreshKey] = (0, react.useState)(0);
			const [prices, setPrices] = (0, react.useState)(() => loadPrices());
			/** Today's UTC bucket — re-passed to KpiRow so「今日」rolls over at midnight. */
			const [dayKey, setDayKey] = (0, react.useState)(utcDayKey);
			/** In-flight summary fetch — aborted when superseded or unmounted. */
			const abortRef = (0, react.useRef)(null);
			/** Monotonic request identity; protects against fetch implementations that ignore abort. */
			const requestIdRef = (0, react.useRef)(0);
			/** Dashboard root — anchor for resetting the shared conversation scrollport. */
			const pageRef = (0, react.useRef)(null);
			/**
			* The shell renders every conversation view inside one shared scrollport
			* (`[data-conversation-scroll]`) and chat leaves it pinned to the bottom.
			* Without this reset the dashboard mounts at that offset and the user lands
			* on the last table row. The layout effect runs before paint, so the first
			* painted frame is already the top; {@link dashboardCss} additionally makes
			* this view its own scrollport, which keeps the shared one from scrolling
			* at all while the dashboard is active.
			*/
			(0, react.useLayoutEffect)(() => {
				const scroller = pageRef.current?.closest("[data-conversation-scroll]");
				if (scroller instanceof HTMLElement) scroller.scrollTop = 0;
			}, []);
			/**
			* `silent` = background poll: never flashes the spinner or surfaces a
			* transient error over good data; `foreground` = first load / manual
			* refresh with the visible spinner and full error card.
			*/
			const load = (0, react.useCallback)(async (mode = "foreground") => {
				const requestId = ++requestIdRef.current;
				setLoading(mode === "foreground");
				abortRef.current?.abort();
				const controller = new AbortController();
				abortRef.current = controller;
				try {
					const response = await fetch(SUMMARY_URL, { signal: controller.signal });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const body = await response.json();
					if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return;
					const at = Date.now();
					summaryMemo = {
						at,
						data: body
					};
					setStats((prev) => sameSummary(prev, body) ? prev : body);
					setError(null);
					setUpdatedAt(at);
				} catch (e) {
					if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return;
					if (e instanceof Error && e.name === "AbortError") return;
					if (mode === "foreground" || summaryMemo === null) setError(e instanceof Error ? e.message : String(e));
				} finally {
					if (requestId === requestIdRef.current) {
						if (abortRef.current === controller) abortRef.current = null;
						setLoading(false);
					}
				}
			}, []);
			(0, react.useEffect)(() => {
				load(summaryMemo === null ? "foreground" : "silent");
				const tick = () => {
					const today = utcDayKey();
					setDayKey((prev) => prev === today ? prev : today);
					if (document.visibilityState === "hidden") return;
					load("silent");
					setRefreshKey((key) => key + 1);
				};
				const timer = window.setInterval(tick, REFRESH_MS);
				const onVisibility = () => {
					if (document.visibilityState !== "visible") return;
					if (summaryMemo !== null && Date.now() - summaryMemo.at < REFRESH_MS) return;
					tick();
				};
				document.addEventListener("visibilitychange", onVisibility);
				return () => {
					window.clearInterval(timer);
					document.removeEventListener("visibilitychange", onVisibility);
					requestIdRef.current += 1;
					abortRef.current?.abort();
				};
			}, [load]);
			const refresh = () => {
				load("foreground");
				setRefreshKey((key) => key + 1);
			};
			const applyPrices = (0, react.useCallback)((next) => {
				setPrices(next);
				savePrices(next);
			}, []);
			const hasData = stats !== null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-root",
				ref: pageRef,
				"data-design": "graphite-console",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: dashboardCss }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsp-frame",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							className: "dsp-header",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-header-brand",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-brand-icon",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconLayers, { color: "currentColor" })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-header-copy",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsp-report-mark",
										children: [
											"DSH ",
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												"aria-hidden": true,
												children: "/"
											}),
											" TOKEN 统计"
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h1", {
										className: "dsp-title",
										children: ["用量控制台", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-scope-tag",
											children: "全部会话"
										})]
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-header-actions",
								children: [
									error !== null && hasData ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsp-head-error",
										children: ["刷新失败 · ", error]
									}) : null,
									updatedAt !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsp-updated",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsp-live-dot",
												"aria-hidden": true
											}),
											new Date(updatedAt).toLocaleTimeString("zh-CN", { hour12: false }),
											" 更新",
											loading ? " · 刷新中…" : ""
										]
									}) : null,
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "dsp-btn dsp-btn-primary",
										onClick: refresh,
										disabled: loading,
										"aria-label": "刷新统计数据",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
											className: loading ? "dsp-spin" : void 0,
											width: "14",
											height: "14",
											viewBox: "0 0 16 16",
											fill: "none",
											"aria-hidden": true,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
												d: "M13.3 6A5.5 5.5 0 1 0 13.5 9M13.3 2.5V6H9.8",
												stroke: "currentColor",
												strokeWidth: "1.4",
												strokeLinecap: "round",
												strokeLinejoin: "round"
											})
										}), loading ? "刷新中" : "刷新数据"]
									})
								]
							})]
						}),
						hasData ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-context-bar",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-context-items",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: stats.modelStats.length }), " 个模型"] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: stats.channelStats.length }), " 个使用渠道"] }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "累计统计 · 含归档" })
								]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsp-context-refresh",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-live-dot",
									"aria-hidden": true
								}), "每 60 秒同步"]
							})]
						}) : null,
						!hasData && error !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-card",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
								className: "dsp-error",
								role: "status",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
									"无法加载统计数据：",
									error,
									"。请确认 dsh 服务运行正常后重试。"
								] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsp-btn dsp-btn-primary",
									onClick: refresh,
									children: "重试"
								})]
							})
						}) : null,
						!hasData && error === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkeletonDashboard, {}) : null,
						hasData ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DashboardBoundary, { children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-fade dsp-stack",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemoKpiRow, {
									stats,
									prices,
									dayKey
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemoChartsRow, { stats }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemoBalancesCard, { refreshKey }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(MemoDetailsCard, {
									stats,
									prices,
									onPricesChange: applyPrices
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
									className: "dsp-footer",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "DSH / Token 统计" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "累计口径含缓存读写 · 费用为价格表估算" })]
								})
							]
						}) }) : null
					]
				})]
			});
		}
		/** First-paint placeholder mirroring the dashboard layout with shimmer blocks. */
		function SkeletonDashboard() {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-stack",
				"aria-hidden": true,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-overview",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-skel",
							style: { minHeight: 156 }
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-kpi-grid",
							children: [
								0,
								1,
								2,
								3
							].map((i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsp-skel",
								style: { minHeight: 120 }
							}, i))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-charts",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-skel",
							style: { height: 310 }
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-skel",
							style: { height: 310 }
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-skel",
						style: { height: 172 }
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-skel",
						style: { height: 300 }
					})
				]
			});
		}
		function KpiRow({ stats, prices, dayKey }) {
			const todayKey = stats.dayKeyNow ?? dayKey;
			const yesterdayKey = (/* @__PURE__ */ new Date((/* @__PURE__ */ new Date(`${todayKey}T00:00:00Z`)).getTime() - 864e5)).toISOString().slice(0, 10);
			const today = stats.dailyStats.find((d) => d.date === todayKey);
			const yesterday = stats.dailyStats.find((d) => d.date === yesterdayKey);
			const unconfigured = stats.modelStats.filter((m) => prices[m.model] === void 0).length;
			const totalCost = stats.modelStats.reduce((sum, m) => sum + modelCost(m, prices[m.model]), 0);
			const totalDisplay = formatTokens(stats.totalTokens);
			const totalUnit = totalDisplay.match(/[KMB]$/)?.[0] ?? "";
			const totalNumber = totalUnit === "" ? totalDisplay : totalDisplay.slice(0, -1);
			let dayChip;
			if (yesterday !== void 0 && yesterday.totalTokens > 0) {
				const delta = ((today?.totalTokens ?? 0) - yesterday.totalTokens) / yesterday.totalTokens * 100;
				const up = delta >= 0;
				dayChip = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					title: "相比昨日",
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrendChip, {
						text: `${up ? "+" : ""}${delta.toFixed(0)}%`,
						up
					})
				});
			}
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: "dsp-overview",
				"aria-label": "使用概览",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsp-feature-metric",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-feature-label",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "累计 Token" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconLayers, { color: "currentColor" })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-feature-number",
							title: `${stats.totalTokens.toLocaleString()} tokens`,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: totalNumber }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-feature-unit",
								children: totalUnit
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-composition",
							"aria-label": "累计 Token 构成",
							children: [
								{
									label: "输入",
									value: stats.totalInputTokens,
									color: "var(--dsp-feature-input)"
								},
								{
									label: "输出",
									value: stats.totalOutputTokens,
									color: "var(--dsp-feature-output)"
								},
								{
									label: "缓存",
									value: stats.totalCacheReadTokens + stats.totalCacheWriteTokens,
									color: "var(--dsp-feature-cache)"
								}
							].map((part) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								title: `${part.label} ${formatTokens(part.value)}`,
								style: {
									width: `${stats.totalTokens > 0 ? part.value / stats.totalTokens * 100 : 0}%`,
									background: part.color
								}
							}, part.label))
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-feature-footer",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "输入" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: formatTokens(stats.totalInputTokens) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "输出" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: formatTokens(stats.totalOutputTokens) })] }),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "缓存" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: formatTokens(stats.totalCacheReadTokens + stats.totalCacheWriteTokens) })] })
							]
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsp-kpi-grid",
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KpiCard, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClock, { color: "currentColor" }),
							label: "今日消耗",
							value: formatTokens(today?.totalTokens ?? 0),
							caption: "今日累计 · 服务端日历",
							sub: today !== void 0 ? `${today.calls.toLocaleString()} 次调用 · ${todayKey.slice(5).replace("-", "/")}` : "今天还没有调用",
							title: "按服务端配置的日历分桶（默认主机本地时区，可用 settings.yaml 的 stats-panel.dayBoundary 改为 utc）",
							chip: dayChip
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KpiCard, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconTarget, { color: "currentColor" }),
							label: "缓存命中率",
							value: `${stats.cacheHitRate.toFixed(1)}%`,
							sub: `读 ${formatTokens(stats.totalCacheReadTokens)} · 写 ${formatTokens(stats.totalCacheWriteTokens)}`,
							meter: stats.cacheHitRate,
							title: "缓存读 ÷ 提示侧总量（未命中输入 + 缓存读 + 缓存写），输出 token 不计入"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KpiCard, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPulse, { color: "currentColor" }),
							label: "总调用次数",
							value: stats.totalCalls.toLocaleString(),
							sub: `平均 ${formatTokens(stats.totalCalls > 0 ? stats.totalTokens / stats.totalCalls : 0)} Token / 次`
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(KpiCard, {
							icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCoin, { color: "currentColor" }),
							label: "估算费用",
							value: formatCny(totalCost),
							caption: "CNY · 累计估算",
							sub: unconfigured > 0 ? `${unconfigured} 个模型未计价` : "人民币 · 按价格表估算",
							title: "累计费用按本机模型价格表估算，不等同于渠道实际账单"
						})
					]
				})]
			});
		}
		/** Day-over-day delta pill (newapi-style trend chip). */
		function TrendChip({ text, up }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: `dsp-trend ${up ? "is-up" : "is-down"}`,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": true,
					children: up ? "↑" : "↓"
				}), text]
			});
		}
		function KpiCard({ icon, label, value, sub, title, chip, meter, caption = "全部会话累计" }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-kpi",
				title,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-kpi-top",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsp-kpi-label",
							children: label
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsp-kpi-icon",
							children: icon
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-kpi-value",
						children: value
					}),
					chip !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-kpi-chip",
						children: [chip, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "较昨日全天" })]
					}) : meter !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-kpi-meter",
						"aria-hidden": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: { width: `${Math.min(100, Math.max(0, meter))}%` } })
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-kpi-caption",
						children: caption
					}),
					sub !== void 0 && sub !== "" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-kpi-sub",
						children: sub
					}) : null
				]
			});
		}
		function ChartsRow({ stats }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-charts",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrendCard, { stats }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ShareCard, { stats })]
			});
		}
		/** Trend card: stacked input/output/cache bars per calendar bucket. */
		function TrendCard({ stats }) {
			const [period, setPeriod] = (0, react.useState)("day");
			const [metric, setMetric] = (0, react.useState)("tokens");
			/** Hovered bar index → floating tooltip (native `title` needs a 1s dwell). */
			const [hover, setHover] = (0, react.useState)(null);
			const series = {
				day: stats.dailyStats ?? [],
				week: stats.weeklyStats ?? [],
				month: stats.monthlyStats ?? []
			};
			const active = series[period].length > 0 ? period : "day";
			const labels = {
				day: "按天",
				week: "按周",
				month: "按月"
			};
			const days = series[active].slice(active === "day" ? -14 : -12);
			const max = Math.max(...days.map((d) => metric === "calls" ? d.calls : d.totalTokens), 1);
			const axisMax = metric === "calls" ? Math.ceil(niceMax(max) / 4) * 4 : niceMax(max);
			const gridFractions = [
				.25,
				.5,
				.75,
				1
			];
			const rangeTotal = days.reduce((sum, d) => sum + d.totalTokens, 0);
			const rangeCalls = days.reduce((sum, d) => sum + d.calls, 0);
			const averageLabel = active === "day" ? "有记录日均" : active === "week" ? "有记录周均" : "有记录月均";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-card dsp-trend-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-card-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-card-title-wrap",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
								className: "dsp-card-title",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPulse, { color: "var(--dsp-accent)" }), "消耗趋势"]
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-seg",
							role: "group",
							"aria-label": "趋势统计周期",
							children: [
								"day",
								"week",
								"month"
							].map((p) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-seg-btn",
								"aria-pressed": p === active,
								disabled: series[p].length === 0,
								onClick: () => {
									setPeriod(p);
									setHover(null);
								},
								children: labels[p]
							}, p))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-chart-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-metric-switch",
							role: "group",
							"aria-label": "趋势指标",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": metric === "tokens",
								onClick: () => {
									setMetric("tokens");
									setHover(null);
								},
								children: "Token"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								"aria-pressed": metric === "calls",
								onClick: () => {
									setMetric("calls");
									setHover(null);
								},
								children: "调用次数"
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: "dsp-legend",
							children: metric === "tokens" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LegendDot, {
									color: COLOR_INPUT,
									text: "输入"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LegendDot, {
									color: COLOR_OUTPUT,
									text: "输出"
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(LegendDot, {
									color: COLOR_CACHE,
									text: "缓存"
								})
							] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(LegendDot, {
								color: COLOR_CACHE,
								text: "调用"
							})
						})]
					}),
					days.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-empty",
						children: "暂无消耗数据"
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-plot",
							onMouseLeave: () => {
								setHover(null);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsp-plot-grid",
									"aria-hidden": true,
									children: gridFractions.map((f) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsp-plot-line",
										style: { bottom: `${f * 100}%` },
										children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-plot-line-label",
											children: metric === "calls" ? Math.round(axisMax * f).toLocaleString() : formatTokens(axisMax * f)
										})
									}, f))
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsp-bars",
									children: days.map((day, i) => {
										const segments = metric === "calls" ? [[COLOR_CACHE, day.calls]] : [
											[COLOR_INPUT, day.inputTokens],
											[COLOR_OUTPUT, day.outputTokens],
											[COLOR_CACHE, day.cacheReadTokens + day.cacheWriteTokens]
										];
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsp-bar-col",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: `dsp-bar-zone${hover === i ? " is-hover" : ""}`,
												role: "img",
												"aria-label": `${day.date} · ${formatTokens(day.totalTokens)} tokens · ${day.calls} 次调用`,
												tabIndex: 0,
												onMouseEnter: () => {
													setHover(i);
												},
												onFocus: () => {
													setHover(i);
												},
												onBlur: () => {
													setHover(null);
												},
												onClick: () => {
													setHover(i);
												},
												children: segments.map(([color, n]) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
													className: "dsp-bar-seg",
													style: {
														background: color,
														height: `${n / axisMax * 100}%`
													}
												}, color))
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: "dsp-bar-label",
												children: formatBucketLabel(day.date, active)
											})]
										}, day.date);
									})
								}),
								hover !== null && days[hover] !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TrendTooltip, {
									day: days[hover],
									calls: days[hover].calls,
									left: (hover + .5) / days.length * 100
								}) : null
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-stat-strip",
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-stat",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsp-stat-label",
										children: "范围内合计"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsp-stat-value",
										children: formatTokens(rangeTotal)
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-stat",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsp-stat-label",
										children: "调用次数"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsp-stat-value",
										children: rangeCalls.toLocaleString()
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-stat",
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsp-stat-label",
										children: averageLabel
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsp-stat-value",
										children: formatTokens(rangeTotal / days.length)
									})]
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-chart-range",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								days[0].date,
								" 至 ",
								days[days.length - 1].date
							] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								"仅影响图表 · ",
								days.length,
								" 个有记录周期"
							] })]
						}),
						stats.bucketNotice !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-notice",
							children: stats.bucketNotice
						}) : null
					] })
				]
			});
		}
		/** Round a maximum up to 1/2/2.5/5 × 10ⁿ so gridlines land on tidy values. */
		function niceMax(value) {
			const base = Math.pow(10, Math.floor(Math.log10(value)));
			for (const m of [
				1,
				2,
				2.5,
				5,
				10
			]) if (value <= m * base) return m * base;
			return 10 * base;
		}
		/** Floating hover card for one trend bar, clamped so edges never clip. */
		function TrendTooltip({ day, calls, left }) {
			const rows = [
				[
					"输入",
					day.inputTokens,
					COLOR_INPUT
				],
				[
					"输出",
					day.outputTokens,
					COLOR_OUTPUT
				],
				[
					"缓存",
					day.cacheReadTokens + day.cacheWriteTokens,
					COLOR_CACHE
				]
			];
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-tooltip",
				style: { left: `clamp(var(--dsp-tooltip-half), ${left}%, calc(100% - var(--dsp-tooltip-half)))` },
				role: "status",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-tooltip-title",
						children: [
							day.date,
							" · ",
							calls.toLocaleString(),
							" 次调用"
						]
					}),
					rows.map(([label, tokens, color]) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-tooltip-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-dot",
								style: { background: color }
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", {
								className: "dsp-tooltip-value",
								children: formatTokens(tokens)
							})
						]
					}, label)),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-tooltip-total",
						children: [
							"共 ",
							formatTokens(day.totalTokens),
							" tokens"
						]
					})
				]
			});
		}
		function LegendDot({ color, text }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: "dsp-legend-item",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: "dsp-dot",
					style: { background: color }
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: text })]
			});
		}
		/** Model distribution: ranked bars keep labels, counts and shares in one reading line. */
		function ShareCard({ stats }) {
			const [dimension, setDimension] = (0, react.useState)("models");
			const data = (dimension === "models" ? stats.modelStats.map((m) => ({
				id: m.model,
				label: m.model,
				totalTokens: m.totalTokens
			})) : stats.channelStats.map((c) => ({
				id: c.channel,
				label: channelName(c.channel),
				totalTokens: c.totalTokens
			}))).sort((a, b) => b.totalTokens - a.totalTokens);
			const total = data.reduce((sum, m) => sum + m.totalTokens, 0);
			const top = data.slice(0, 5);
			const rest = Math.max(0, total - top.reduce((sum, m) => sum + m.totalTokens, 0));
			const rows = top.map((m) => ({
				id: m.id,
				label: m.label,
				tokens: m.totalTokens
			}));
			if (rest > 0) rows.push({
				id: "__other__",
				label: `其他 ${data.length - top.length} 个${dimension === "models" ? "模型" : "渠道"}`,
				tokens: rest
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-card dsp-share-card",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsp-card-head",
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
						className: "dsp-card-title",
						children: "用量分布"
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-seg",
						role: "group",
						"aria-label": "用量分布维度",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsp-seg-btn",
							"aria-pressed": dimension === "models",
							onClick: () => {
								setDimension("models");
							},
							children: "模型"
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsp-seg-btn",
							"aria-pressed": dimension === "channels",
							onClick: () => {
								setDimension("channels");
							},
							children: "渠道"
						})]
					})]
				}), rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: "dsp-empty",
					children: "暂无模型数据"
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-share-summary",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "累计 Token 占比" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							data.length,
							" 个",
							dimension === "models" ? "模型" : "渠道"
						] })]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-share-composition",
						"aria-hidden": true,
						children: rows.map((row, i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
							width: `${total > 0 ? row.tokens / total * 100 : 0}%`,
							background: CHART_COLORS[i % CHART_COLORS.length]
						} }, row.id))
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-share-legend",
						children: rows.map((row, i) => {
							const share = total > 0 ? row.tokens / total * 100 : 0;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-share-row",
								title: `${row.label} · ${row.tokens.toLocaleString()} tokens · ${share.toFixed(1)}%`,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsp-share-name",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-dot",
											style: { background: CHART_COLORS[i % CHART_COLORS.length] }
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: row.label })]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: "dsp-share-tokens",
										children: formatTokens(row.tokens)
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsp-share-pct",
										children: [share.toFixed(1), "%"]
									})
								]
							}, row.id);
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-share-foot",
						children: ["按总 Token 排序", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "完整数据见下方明细" })]
					})
				] })]
			});
		}
		/**
		* Format a millisecond span as "X天 X小时 X分钟" (omitting empty units).
		* Exported for tests.
		*/
		function formatDuration(ms) {
			if (!Number.isFinite(ms)) return "—";
			if (ms <= 0) return "已过期";
			const totalMinutes = Math.floor(ms / 6e4);
			const days = Math.floor(totalMinutes / 1440);
			const hours = Math.floor(totalMinutes % 1440 / 60);
			const minutes = totalMinutes % 60;
			const parts = [];
			if (days > 0) parts.push(`${days}天`);
			if (hours > 0) parts.push(`${hours}小时`);
			if (minutes > 0 && days === 0) parts.push(`${minutes}分钟`);
			return parts.length > 0 ? parts.join(" ") : `${totalMinutes}分钟`;
		}
		/**
		* Channel account statuses: auto-fetched balances/quotas plus manual entries
		* for channels without a public API. Paints the last page-session payload
		* instantly, then revalidates; auto reloads are throttled to
		* {@link BALANCES_TTL_MS} (probes hit real provider APIs), the button always
		* refetches.
		*/
		function BalancesCard({ refreshKey }) {
			const [balances, setBalances] = (0, react.useState)(() => balancesMemo?.data ?? []);
			const [loading, setLoading] = (0, react.useState)(() => balancesMemo === null);
			const [manual, setManual] = (0, react.useState)(() => loadManualQuota());
			const [editing, setEditing] = (0, react.useState)(null);
			const [draftNote, setDraftNote] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [issuesOnly, setIssuesOnly] = (0, react.useState)(false);
			/** In-flight balances fetch — aborted when superseded/unmounted. */
			const abortRef = (0, react.useRef)(null);
			/** Monotonic request identity; abort alone is not sufficient for every fetch implementation. */
			const requestIdRef = (0, react.useRef)(0);
			const load = (0, react.useCallback)(async (mode = "foreground") => {
				const requestId = ++requestIdRef.current;
				setLoading(mode === "foreground");
				abortRef.current?.abort();
				const controller = new AbortController();
				abortRef.current = controller;
				try {
					const response = await fetch(BALANCES_URL, { signal: controller.signal });
					if (!response.ok) throw new Error(`HTTP ${response.status}`);
					const body = await response.json();
					if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return;
					const rows = Array.isArray(body.balances) ? body.balances : [];
					balancesMemo = {
						at: Date.now(),
						data: rows
					};
					setBalances(rows);
				} catch (e) {
					if (!isCurrentRequest(requestId, requestIdRef.current, controller.signal.aborted)) return;
					if (e instanceof Error && e.name === "AbortError") return;
					if (balancesMemo === null) setBalances([{
						channel: "error",
						kind: "manual",
						displayName: "查询失败",
						error: e instanceof Error ? e.message : String(e)
					}]);
				} finally {
					if (requestId === requestIdRef.current) {
						if (abortRef.current === controller) abortRef.current = null;
						setLoading(false);
					}
				}
			}, []);
			(0, react.useEffect)(() => {
				if (balancesMemo === null) load("foreground");
				else if (Date.now() - balancesMemo.at >= BALANCES_TTL_MS) load("silent");
			}, [load]);
			(0, react.useEffect)(() => {
				if (refreshKey === 0) return;
				if (balancesMemo !== null && Date.now() - balancesMemo.at < BALANCES_TTL_MS) return;
				load("silent");
			}, [load, refreshKey]);
			(0, react.useEffect)(() => () => {
				requestIdRef.current += 1;
				abortRef.current?.abort();
			}, []);
			const saveManual = (channel) => {
				const next = {
					...manual,
					[channel]: draftNote.trim()
				};
				setManual(next);
				try {
					window.localStorage.setItem(MANUAL_QUOTA_KEY, JSON.stringify(next));
				} catch {}
				setEditing(null);
			};
			const rows = balances.map((row) => row.kind === "manual" && manual[row.channel] !== void 0 ? {
				...row,
				note: manual[row.channel]
			} : row);
			const manualNames = new Set(balances.filter((b) => b.kind === "manual").map((b) => b.channel));
			for (const channel of Object.keys(manual)) manualNames.add(channel);
			for (const channel of manualNames) {
				if (balances.some((b) => b.channel === channel)) continue;
				rows.push({
					channel,
					kind: "manual",
					displayName: channelName(channel),
					note: manual[channel]
				});
			}
			if (rows.length === 0 && !loading) rows.push({
				channel: "none",
				kind: "manual",
				displayName: "未发现渠道",
				note: "请先在设置 → 模型中配置渠道"
			});
			const needsAttention = (row) => row.error !== void 0 || row.kind === "manual" && !row.note;
			const issueCount = rows.filter(needsAttention).length;
			const filteredRows = issuesOnly ? rows.filter(needsAttention) : rows;
			const visibleRows = expanded ? filteredRows : filteredRows.slice(0, 6);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-card dsp-balances-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-card-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-card-title-wrap",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
								className: "dsp-card-title",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconLayers, { color: "var(--dsp-accent)" }), "渠道余量与余额"]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-filter-chips",
								role: "group",
								"aria-label": "渠道状态筛选",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									"aria-pressed": !issuesOnly,
									onClick: () => {
										setIssuesOnly(false);
										setExpanded(false);
									},
									children: ["全部 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: rows.length })]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									"aria-pressed": issuesOnly,
									onClick: () => {
										setIssuesOnly(true);
										setExpanded(false);
									},
									children: ["待处理 ", /* @__PURE__ */ (0, react_jsx_runtime.jsx)("b", { children: issueCount })]
								})]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsp-card-actions",
							children: [loading ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-inline-muted",
								children: "查询中…"
							}) : null, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								onClick: () => {
									load("foreground");
								},
								disabled: loading,
								"aria-label": "刷新渠道余额",
								children: "刷新余额"
							})]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-balance-grid",
						children: visibleRows.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BalanceRowCard, {
							row,
							editing,
							draftNote,
							onEdit: (channel) => {
								setDraftNote(manual[channel] ?? "");
								setEditing(channel);
							},
							onCancel: () => {
								setEditing(null);
							},
							onDraft: setDraftNote,
							onSave: saveManual
						}, row.channel))
					}),
					loading && rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-balance-grid",
						"aria-label": "正在查询渠道余额",
						children: [
							0,
							1,
							2
						].map((i) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-skel",
							style: { height: 130 }
						}, i))
					}) : null,
					!loading && filteredRows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-empty",
						children: "没有待处理的渠道"
					}) : null,
					filteredRows.length > 6 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-expand-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							"显示 ",
							visibleRows.length,
							" / ",
							filteredRows.length,
							" 个渠道"
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							className: "dsp-btn dsp-btn-quiet",
							type: "button",
							onClick: () => {
								setExpanded((value) => !value);
							},
							children: [expanded ? "收起渠道" : `查看全部 ${filteredRows.length} 个渠道`, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": true,
								children: expanded ? "↑" : "↓"
							})]
						})]
					}) : null
				]
			});
		}
		const BALANCE_KIND_LABEL = {
			balance: "余额",
			plan: "套餐",
			manual: "手动",
			error: "错误"
		};
		function BalanceRowCard({ row, editing, draftNote, onEdit, onCancel, onDraft, onSave }) {
			const ok = row.error === void 0 && row.kind !== "manual";
			const statusColor = row.error !== void 0 ? "var(--dsp-bad)" : ok ? "var(--dsp-good)" : "var(--dsp-warn)";
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: `dsp-balance${row.error !== void 0 ? " is-error" : ""}`,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-balance-head",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-channel-symbol",
								"aria-hidden": true,
								children: row.displayName.slice(0, 1).toUpperCase()
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-balance-name",
								title: `${row.displayName} · ${row.channel}`,
								children: row.displayName
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsp-badge",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-status-dot",
									style: { background: statusColor }
								}), row.error !== void 0 ? "查询异常" : BALANCE_KIND_LABEL[row.kind]]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-balance-body",
						children: row.error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
							className: "dsp-error-details",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "查询失败 · 查看详情" }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsp-balance-error",
								children: row.error
							})]
						}) : row.kind === "balance" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-balance-value",
							children: [row.currency === "CNY" ? "¥" : row.currency === "USD" ? "$" : "", row.balance ?? "—"]
						}), row.note !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-balance-note",
							title: row.note,
							children: row.note
						}) : null] }) : row.kind === "plan" && row.quota !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-quotas",
							children: row.quota.map((q) => {
								const remainingMs = q.resetsAt !== "" ? new Date(q.resetsAt).getTime() - Date.now() : 0;
								const percent = Math.min(100, Math.max(0, q.percent));
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-quota",
									title: `重置于 ${q.resetsAt}`,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsp-quota-top",
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsp-quota-label",
												children: q.label
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: "dsp-quota-pct",
												children: [q.percent, "%"]
											})]
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: "dsp-quota-track",
											role: "progressbar",
											"aria-label": `${row.displayName} ${q.label}已用额度`,
											"aria-valuemin": 0,
											"aria-valuemax": 100,
											"aria-valuenow": percent,
											children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsp-quota-fill",
												style: {
													width: `${percent}%`,
													background: quotaColor(percent)
												}
											})
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: "dsp-quota-foot",
											children: [q.used !== void 0 && q.limit !== void 0 ? `已用 ${formatTokens(q.used)} / ${formatTokens(q.limit)}` : "额度", q.resetsAt !== "" ? ` · 剩余 ${formatDuration(remainingMs)}` : ""]
										})
									]
								}, q.label);
							})
						}) : row.kind === "plan" && row.usage !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-quotas",
							children: row.usage.map((u) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-quota",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsp-quota-top",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: "dsp-quota-label",
										children: [u.label, u.approximate === true ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											title: "窗口边界所在的桶由上游整桶返回，无法按时刻拆分，数值为近似值",
											children: "（近似）"
										}) : null]
									})
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-quota-foot",
									children: [
										"输入 ",
										formatTokens(u.inputTokens),
										" · 输出 ",
										formatTokens(u.outputTokens)
									]
								})]
							}, u.label))
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: editing === row.channel ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-manual-edit",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								className: "dsp-input",
								type: "text",
								"aria-label": `${row.displayName} 手动额度`,
								placeholder: "如：剩余 18天 3小时 或 4100M Credits",
								value: draftNote,
								onChange: (e) => {
									onDraft(e.target.value);
								}
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-manual-actions",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsp-btn dsp-btn-primary",
									onClick: () => {
										onSave(row.channel);
									},
									children: "保存"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsp-btn",
									onClick: onCancel,
									children: "取消"
								})]
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-manual",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-manual-value",
								children: row.note !== void 0 && row.note !== "" ? row.note : "待配置"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								onClick: () => {
									onEdit(row.channel);
								},
								children: row.note !== void 0 && row.note !== "" ? "修改" : "配置"
							})]
						}) })
					}),
					row.error !== void 0 ? null : row.kind === "balance" && row.fetchedAt !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-balance-foot",
						children: ["查询于 ", new Date(row.fetchedAt).toLocaleTimeString()]
					}) : row.kind === "manual" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: "dsp-balance-foot",
						children: "手动维护 · 以平台控制台为准"
					}) : null
				]
			});
		}
		/** Quota bar color: green when plenty remains, amber → red as usage climbs. */
		function quotaColor(percent) {
			if (percent >= 90) return "var(--dsp-bad)";
			if (percent >= 70) return "var(--dsp-warn)";
			return "var(--dsp-good)";
		}
		const DETAIL_TABS = [
			{
				id: "models",
				label: "模型统计"
			},
			{
				id: "channels",
				label: "渠道统计"
			},
			{
				id: "records",
				label: "调用记录"
			},
			{
				id: "prices",
				label: "模型价格"
			}
		];
		/** Tabbed detail card: usage breakdowns, price editor and recent records. */
		function DetailsCard({ stats, prices, onPricesChange }) {
			const [tab, setTab] = (0, react.useState)("models");
			/** `null` = not editing; editing keeps a string draft so decimals type naturally. */
			const [draft, setDraft] = (0, react.useState)(null);
			const [query, setQuery] = (0, react.useState)("");
			const [sort, setSort] = (0, react.useState)("tokens");
			const [page, setPage] = (0, react.useState)(0);
			const editing = draft !== null;
			const modelRows = rankUsage(stats.modelStats.filter((m) => matchesQuery(query, m.model)), sort);
			const channelRows = rankUsage(stats.channelStats.filter((c) => matchesQuery(query, c.channel, channelName(c.channel), ...c.models)), sort);
			const recordRows = stats.recentRecords.filter((r) => matchesQuery(query, r.model, r.provider, channelName(r.provider)));
			const rowCount = tab === "channels" ? channelRows.length : tab === "records" ? recordRows.length : modelRows.length;
			const totalCount = tab === "channels" ? stats.channelStats.length : tab === "records" ? stats.recentRecords.length : stats.modelStats.length;
			const pageSize = tab === "records" ? 10 : 8;
			const pageCount = Math.max(1, Math.ceil(rowCount / pageSize));
			const currentPage = Math.min(page, pageCount - 1);
			const start = currentPage * pageSize;
			const modelTotal = stats.modelStats.reduce((sum, m) => sum + m.totalTokens, 0);
			const channelTotal = stats.channelStats.reduce((sum, c) => sum + c.totalTokens, 0);
			const exportRows = () => {
				let headers;
				let rows;
				if (tab === "channels") {
					headers = [
						"渠道",
						"模型",
						"调用次数",
						"输入 Token",
						"输出 Token",
						"缓存读 Token",
						"缓存写 Token",
						"总 Token"
					];
					rows = channelRows.map((c) => [
						c.channel,
						c.models.join(" / "),
						c.calls,
						c.inputTokens,
						c.outputTokens,
						c.cacheReadTokens,
						c.cacheWriteTokens,
						c.totalTokens
					]);
				} else if (tab === "records") {
					headers = [
						"时间",
						"渠道",
						"模型",
						"输入 Token",
						"输出 Token",
						"缓存读 Token",
						"缓存写 Token",
						"推理 Token"
					];
					rows = recordRows.map((r) => [
						new Date(r.ts).toISOString(),
						r.provider,
						r.model,
						r.inputTokens,
						r.outputTokens,
						r.cacheReadTokens,
						r.cacheWriteTokens,
						r.reasoningTokens
					]);
				} else if (tab === "prices") {
					headers = [
						"模型",
						"输入 元/1M",
						"输出 元/1M",
						"缓存读 元/1M",
						"缓存写 元/1M"
					];
					rows = modelRows.map((m) => [m.model, ...PRICE_FIELDS.map((field) => prices[m.model]?.[field] ?? "未配置")]);
				} else {
					headers = [
						"模型",
						"调用次数",
						"输入 Token",
						"输出 Token",
						"缓存读 Token",
						"缓存写 Token",
						"总 Token",
						"估算费用 CNY"
					];
					rows = modelRows.map((m) => [
						m.model,
						m.calls,
						m.inputTokens,
						m.outputTokens,
						m.cacheReadTokens,
						m.cacheWriteTokens,
						m.totalTokens,
						prices[m.model] === void 0 ? "未配置" : modelCost(m, prices[m.model])
					]);
				}
				downloadCsv(usageCsv(headers, rows), `dsh-${tab}-${stats.dayKeyNow ?? utcDayKey()}.csv`);
			};
			const applyDraft = () => {
				if (draft !== null) onPricesChange(draftToPrices(draft));
				setDraft(null);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-card dsp-details-card",
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-card-head",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("h2", {
							className: "dsp-card-title",
							children: ["用量明细", /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: "dsp-count-badge",
								children: [stats.totalCalls.toLocaleString(), " 次调用"]
							})]
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "dsp-btn",
							disabled: rowCount === 0 || editing,
							onClick: exportRows,
							title: "导出当前分类的全部搜索结果，不限于当前分页",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconDownload, {}), "导出 CSV"]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-detail-toolbar",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-detail-tabs",
							role: "group",
							"aria-label": "用量明细分类",
							children: DETAIL_TABS.map((t) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-seg-btn",
								"aria-pressed": t.id === tab,
								onClick: () => {
									setTab(t.id);
									setQuery("");
									setPage(0);
								},
								children: t.label
							}, t.id))
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-detail-controls",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsp-search",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSearch, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "search",
									"aria-label": "搜索用量明细",
									placeholder: tab === "channels" || tab === "records" ? "搜索模型或渠道…" : "搜索模型…",
									value: query,
									onChange: (e) => {
										setQuery(e.target.value);
										setPage(0);
									}
								})]
							}), tab === "models" || tab === "channels" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
								className: "dsp-select",
								"aria-label": "明细排序",
								value: sort,
								onChange: (e) => {
									setSort(e.target.value);
									setPage(0);
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "tokens",
									children: "Token 从高到低"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "calls",
									children: "调用次数从高到低"
								})]
							}) : null]
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-detail-context",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [tab === "records" ? `最近 ${totalCount} 条记录 · 非全部历史` : tab === "prices" ? "价格仅保存在当前浏览器 · 不更改渠道账单" : "累计用量 · 占比按全部数据计算", query.trim() ? ` · 匹配 ${rowCount} 项` : ""] }), tab === "prices" ? editing ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsp-card-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								onClick: () => {
									setDraft(null);
								},
								children: "取消"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn dsp-btn-primary",
								onClick: applyDraft,
								children: "保存"
							})]
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
							className: "dsp-card-actions",
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-card-hint",
								children: "单位：元 / 1M tokens"
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								onClick: () => {
									setDraft(toPriceDraft(prices));
								},
								children: "编辑价格"
							})]
						}) : null]
					}),
					query.trim() && rowCount === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-empty",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconSearch, {}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: "没有匹配的结果" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "换一个模型名称或渠道关键词" }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								onClick: () => {
									setQuery("");
									setPage(0);
								},
								children: "清除搜索"
							})
						]
					}) : null,
					tab === "models" && !(query.trim() && rowCount === 0) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ModelBreakdown, {
						data: modelRows.slice(start, start + pageSize),
						prices,
						total: modelTotal,
						offset: start
					}) : null,
					tab === "channels" && !(query.trim() && rowCount === 0) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChannelBreakdown, {
						data: channelRows.slice(start, start + pageSize),
						total: channelTotal,
						offset: start
					}) : null,
					tab === "prices" && !(query.trim() && rowCount === 0) ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("details", {
						className: "dsp-pricing-note",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("summary", { children: "计价说明与数据来源" }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("p", {
							className: "dsp-hint",
							children: [
								"内置价格为官方牌价（人民币 元/1M tokens；美元模型按 ≈7.1 汇率折算），来源与生效时间见",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									href: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
									target: "_blank",
									rel: "noreferrer",
									className: "dsp-link",
									children: " DeepSeek"
								}),
								"、",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									href: "https://developers.openai.com/api/docs/pricing",
									target: "_blank",
									rel: "noreferrer",
									className: "dsp-link",
									children: " OpenAI"
								}),
								"、",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("a", {
									href: "https://www.anthropic.com/claude/opus/5",
									target: "_blank",
									rel: "noreferrer",
									className: "dsp-link",
									children: " Anthropic"
								}),
								" 等官方页。 你编辑过的模型以你的价格为准；缺失模型自动用内置默认价补齐。 套餐内模型（MiMo Token Plan）与免费模型（ox-alpha-free 等）计 0，避免与套餐/免费额度重复计费； DeepSeek 官方为峰谷计价（周一至五 9-12/14-18 为高峰），内置取高峰价、空闲时段实际减半； 中转站实际扣费可能低于牌价（如 Sub2API 折扣），估算值会偏高。"
							]
						})]
					}), editing && draft !== null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PriceEditor, {
						draft,
						onChange: setDraft,
						models: modelRows.slice(start, start + pageSize).map((m) => m.model)
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(PriceList, {
						rows: modelRows.slice(start, start + pageSize).map((m) => m.model),
						prices
					})] }) : null,
					tab === "records" && !(query.trim() && rowCount === 0) ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(RecordsList, {
						data: recordRows.slice(start, start + pageSize),
						prices
					}) : null,
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-pagination",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
							rowCount > 0 ? `${start + 1}–${Math.min(start + pageSize, rowCount)}` : "0",
							" / ",
							rowCount,
							" 项",
							query.trim() ? ` · 全部 ${totalCount} 项` : ""
						] }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								"aria-label": "明细上一页",
								disabled: currentPage === 0,
								onClick: () => {
									setPage(currentPage - 1);
								},
								children: "上一页"
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
								currentPage + 1,
								" / ",
								pageCount
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								"aria-label": "明细下一页",
								disabled: currentPage >= pageCount - 1,
								onClick: () => {
									setPage(currentPage + 1);
								},
								children: "下一页"
							})
						] })]
					})
				]
			});
		}
		/** Model breakdown as ranked rows — no spreadsheet grid, hierarchy per row. */
		function ModelBreakdown({ data, prices, total, offset }) {
			if (data.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsp-empty",
				children: "暂无模型数据"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-rows",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsp-table-head",
					"aria-hidden": true,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "模型 / 调用与消耗" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "用量占比" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "总 Token" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "估算费用" })
					]
				}), data.map((m, i) => {
					const share = total > 0 ? m.totalTokens / total * 100 : 0;
					const price = prices[m.model];
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-row-main",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-row-title",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-rank",
											children: String(offset + i + 1).padStart(2, "0")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-row-name",
											title: m.model,
											children: m.model
										}),
										price === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-tag is-warn",
											children: "价格待配置"
										}) : null
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-row-sub",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [m.calls.toLocaleString(), " 次调用"] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-sep",
											children: "·"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["输入 ", formatTokens(m.inputTokens)] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-sep",
											children: "·"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["输出 ", formatTokens(m.outputTokens)] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-sep",
											children: "·"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["缓存 ", formatTokens(m.cacheReadTokens + m.cacheWriteTokens)] })
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-row-share",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsp-track",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
										display: "block",
										height: "100%",
										borderRadius: 999,
										width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
										background: CHART_COLORS[i % CHART_COLORS.length]
									} })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsp-track-pct",
									children: [share.toFixed(1), "%"]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-metric",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-value",
									children: formatTokens(m.totalTokens)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-label",
									children: "总 Token"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-metric is-cost",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-value",
									children: price === void 0 ? "未计价" : formatCny(modelCost(m, price))
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-label",
									children: "估算费用"
								})]
							})
						]
					}, m.model);
				})]
			});
		}
		/** Channel breakdown with the same ranked-row language as the model list. */
		function ChannelBreakdown({ data, total, offset }) {
			if (data.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsp-empty",
				children: "暂无渠道数据"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-rows",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: "dsp-table-head",
					"aria-hidden": true,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "渠道 / 模型与消耗" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "用量占比" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "总 Token" }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: "调用次数" })
					]
				}), data.map((c, i) => {
					const share = total > 0 ? c.totalTokens / total * 100 : 0;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-row",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-row-main",
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsp-row-title",
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-rank",
											children: String(offset + i + 1).padStart(2, "0")
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-row-name",
											children: channelName(c.channel)
										})]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: "dsp-row-sub",
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["输入 ", formatTokens(c.inputTokens)] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsp-sep",
												children: "·"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["输出 ", formatTokens(c.outputTokens)] }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: "dsp-sep",
												children: "·"
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["缓存 ", formatTokens(c.cacheReadTokens + c.cacheWriteTokens)] })
										]
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
										className: "dsp-row-sub dsp-row-models",
										title: c.models.join(", "),
										children: c.models.join(" · ")
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-row-share",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsp-track",
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { style: {
										display: "block",
										height: "100%",
										borderRadius: 999,
										width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
										background: CHART_COLORS[i % CHART_COLORS.length]
									} })
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: "dsp-track-pct",
									children: [share.toFixed(1), "%"]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-metric",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-value",
									children: formatTokens(c.totalTokens)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-label",
									children: "总 Token"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-metric",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-value",
									children: c.calls.toLocaleString()
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-label",
									children: "调用次数"
								})]
							})
						]
					}, c.channel);
				})]
			});
		}
		/** Recent calls as a compact timeline list instead of a wide table. */
		function RecordsList({ data, prices }) {
			if (data.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsp-empty",
				children: "暂无调用记录（历史明细已折叠为总量统计，各项数字不受影响）"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsp-records",
				children: data.map((r) => {
					const total = r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens;
					const cost = modelCost({
						model: r.model,
						calls: 1,
						inputTokens: r.inputTokens,
						outputTokens: r.outputTokens,
						cacheReadTokens: r.cacheReadTokens,
						cacheWriteTokens: r.cacheWriteTokens,
						reasoningTokens: r.reasoningTokens,
						totalTokens: total
					}, prices[r.model]);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-record",
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: "dsp-record-time",
								children: formatRecordTime(r.ts)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-record-main",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: "dsp-record-model",
									title: r.model,
									children: r.model
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: "dsp-record-sub",
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-tag",
											children: channelName(r.provider)
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["输入 ", formatTokens(r.inputTokens)] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-sep",
											children: "·"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["输出 ", formatTokens(r.outputTokens)] }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: "dsp-sep",
											children: "·"
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: ["缓存 ", formatTokens(r.cacheReadTokens + r.cacheWriteTokens)] })
									]
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-metric",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-value",
									children: formatTokens(total)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-label",
									children: "总 Token"
								})]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-metric is-cost",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-value",
									children: prices[r.model] === void 0 ? "未计价" : formatCny(cost)
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-metric-label",
									children: "费用"
								})]
							})
						]
					}, `${r.sessionId}-${r.seq}`);
				})
			});
		}
		const PRICE_FIELDS = [
			"inputPerM",
			"outputPerM",
			"cacheReadPerM",
			"cacheWritePerM"
		];
		const PRICE_FIELD_LABELS = {
			inputPerM: "输入",
			outputPerM: "输出",
			cacheReadPerM: "缓存命中",
			cacheWritePerM: "缓存写入"
		};
		function toPriceDraft(prices) {
			const draft = {};
			for (const [model, price] of Object.entries(prices)) draft[model] = {
				inputPerM: String(price.inputPerM),
				outputPerM: String(price.outputPerM),
				cacheReadPerM: String(price.cacheReadPerM),
				cacheWritePerM: String(price.cacheWritePerM)
			};
			return draft;
		}
		function draftToPrices(draft) {
			const prices = {};
			for (const [model, fields] of Object.entries(draft)) {
				const price = {
					inputPerM: 0,
					outputPerM: 0,
					cacheReadPerM: 0,
					cacheWritePerM: 0
				};
				for (const field of PRICE_FIELDS) {
					const num = Number(fields[field]);
					price[field] = Number.isFinite(num) ? num : 0;
				}
				prices[model] = price;
			}
			return prices;
		}
		/** Read-only price list: one settings-style row per model. */
		function PriceList({ rows, prices }) {
			if (rows.length === 0) return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsp-empty",
				children: "暂无模型数据"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsp-price-list",
				children: rows.map((model) => {
					const p = prices[model];
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-price-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-price-model",
							title: model,
							children: model
						}), p === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-price-fields",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								className: "dsp-tag is-warn",
								children: "价格待配置（不计入费用）"
							})
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-price-fields",
							children: PRICE_FIELDS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: "dsp-price-cell",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-price-label",
									children: PRICE_FIELD_LABELS[field]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-price-value",
									children: p[field]
								})]
							}, field))
						})]
					}, model);
				})
			});
		}
		/** Editable price list — same row language, number inputs instead of values. */
		function PriceEditor({ draft, onChange, models }) {
			const set = (model, field, value) => {
				const row = { ...draft[model] ?? {
					inputPerM: "0",
					outputPerM: "0",
					cacheReadPerM: "0",
					cacheWritePerM: "0"
				} };
				row[field] = value;
				onChange({
					...draft,
					[model]: row
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: "dsp-price-list",
				children: models.map((model) => {
					const p = draft[model] ?? {
						inputPerM: "0",
						outputPerM: "0",
						cacheReadPerM: "0",
						cacheWritePerM: "0"
					};
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: "dsp-price-row",
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-price-model",
							title: model,
							children: model
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-price-fields",
							children: PRICE_FIELDS.map((field) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: "dsp-price-cell",
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: "dsp-price-label",
									children: PRICE_FIELD_LABELS[field]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									"aria-label": `${model} ${PRICE_FIELD_LABELS[field]}价格`,
									className: "dsp-input",
									type: "number",
									step: "0.001",
									min: "0",
									value: p[field],
									onChange: (e) => {
										set(model, field, e.target.value);
									}
								})]
							}, field))
						})]
					}, model);
				})
			});
		}
		/**
		* Memoized dashboard sections: an auto-refresh with an unchanged payload
		* keeps the old object references, so only the header clock re-renders —
		* the charts and the 100-row tables stay untouched.
		*/
		const MemoKpiRow = react.default.memo(KpiRow);
		const MemoChartsRow = react.default.memo(ChartsRow);
		const MemoBalancesCard = react.default.memo(BalancesCard);
		const MemoDetailsCard = react.default.memo(DetailsCard);
		//#endregion
		//#region src/client/index.ts
		/** Required services (fiber inject waiting — the runtime must be up first). */
		const inject = ["slots"];
		/**
		* Mount the usage dashboard as a conversation view tab.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const slots = ctx.slots;
			slots.inject("conversation.view", () => slots.register({
				name: "conversation.view",
				id: "stats",
				order: 40,
				label: () => "Token 统计"
			}, StatsView));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map