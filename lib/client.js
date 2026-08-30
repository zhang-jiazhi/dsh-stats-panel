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
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		react = __toESM(react, 1);
		//#region lib/types/client/stats-panel.js
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
		/** Chart palette — input / output / cache series and categorical fills. */
		const COLOR_INPUT = "#4a9eff";
		const COLOR_OUTPUT = "#51cf66";
		const COLOR_CACHE = "#cc5de8";
		const CHART_COLORS = [
			"#4a9eff",
			"#51cf66",
			"#cc5de8",
			"#ffd43b",
			"#ff922b",
			"#20c997",
			"#ff6b6b",
			"#868e96"
		];
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
		/** Cost of one model's usage under a price entry, CNY. */
		function modelCost(stat, price) {
			if (price === void 0) return 0;
			return stat.inputTokens / 1e6 * price.inputPerM + stat.outputTokens / 1e6 * price.outputPerM + stat.cacheReadTokens / 1e6 * price.cacheReadPerM + stat.cacheWriteTokens / 1e6 * price.cacheWritePerM;
		}
		function loadPrices() {
			try {
				const raw = window.localStorage.getItem(PRICES_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (typeof parsed === "object" && parsed !== null) return {
						...DEFAULT_PRICES,
						...parsed
					};
				}
			} catch {}
			return { ...DEFAULT_PRICES };
		}
		function savePrices(prices) {
			try {
				window.localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
			} catch {}
		}
		function loadManualQuota() {
			try {
				const raw = window.localStorage.getItem(MANUAL_QUOTA_KEY);
				if (raw !== null) {
					const parsed = JSON.parse(raw);
					if (typeof parsed === "object" && parsed !== null) return parsed;
				}
			} catch {}
			return {};
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
		*/
		function sameSummary(a, b) {
			return a !== null && JSON.stringify(a) === JSON.stringify(b);
		}
		/** Today's UTC bucket key — matches the host's `toISOString` day bucketing. */
		function utcDayKey() {
			return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
		}
		/** Minimal stroke icons for the KPI chips (16×16 grid, currentColor-free). */
		function IconPulse({ color }) {
			return (0, react_jsx_runtime.jsx)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: (0, react_jsx_runtime.jsx)("path", {
					d: "M1.5 8h2.6l2-4.6 3 9.2 2-4.6h3.4",
					stroke: color,
					strokeWidth: 1.5,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			});
		}
		function IconLayers({ color }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [(0, react_jsx_runtime.jsx)("path", {
					d: "M8 1.8 14.2 5 8 8.2 1.8 5 8 1.8Z",
					stroke: color,
					strokeWidth: 1.4,
					strokeLinejoin: "round"
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M2.5 8.4 8 11.2l5.5-2.8M2.5 11.4 8 14.2l5.5-2.8",
					stroke: color,
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function IconClock({ color }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [(0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 6.2,
					stroke: color,
					strokeWidth: 1.4
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M8 4.6V8l2.4 1.6",
					stroke: color,
					strokeWidth: 1.4,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		function IconTarget({ color }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [(0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 6.2,
					stroke: color,
					strokeWidth: 1.4
				}), (0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 2.6,
					stroke: color,
					strokeWidth: 1.4
				})]
			});
		}
		function IconCoin({ color }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: 14,
				height: 14,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [(0, react_jsx_runtime.jsx)("circle", {
					cx: 8,
					cy: 8,
					r: 6.2,
					stroke: color,
					strokeWidth: 1.4
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M5.6 4.8 8 7.6l2.4-2.8M8 7.6v3.8M6.2 9.4h3.6M6.2 11h3.6",
					stroke: color,
					strokeWidth: 1.2,
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
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
				if (this.state.error !== null) return (0, react_jsx_runtime.jsx)("div", {
					style: styles.card,
					children: (0, react_jsx_runtime.jsxs)("p", {
						style: styles.error,
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
			return (0, react_jsx_runtime.jsxs)("div", {
				style: styles.page,
				children: [(0, react_jsx_runtime.jsx)("style", { children: dashboardCss }), (0, react_jsx_runtime.jsxs)("div", {
					style: styles.frame,
					children: [
						(0, react_jsx_runtime.jsxs)("header", {
							style: styles.head,
							children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("div", {
								style: styles.headTitle,
								children: "Token 使用统计"
							}), (0, react_jsx_runtime.jsx)("div", {
								style: styles.headSub,
								children: "模型用量 · 缓存命中率 · 渠道余量 · 费用估算（人民币）"
							})] }), (0, react_jsx_runtime.jsxs)("div", {
								style: styles.headActions,
								children: [
									error !== null && hasData ? (0, react_jsx_runtime.jsxs)("span", {
										style: styles.headError,
										children: ["刷新失败 · ", error]
									}) : null,
									updatedAt !== null ? (0, react_jsx_runtime.jsxs)("span", {
										style: styles.headUpdated,
										children: [
											"更新于 ",
											new Date(updatedAt).toLocaleTimeString(),
											loading ? " · 刷新中…" : ""
										]
									}) : null,
									(0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: "dsp-btn",
										style: styles.button,
										onClick: refresh,
										disabled: loading,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: loading ? "dsp-spin" : void 0,
											style: styles.buttonGlyph,
											children: "⟳"
										}), "刷新"]
									})
								]
							})]
						}),
						!hasData && error !== null ? (0, react_jsx_runtime.jsx)("div", {
							style: styles.card,
							children: (0, react_jsx_runtime.jsxs)("p", {
								style: styles.error,
								role: "status",
								children: [(0, react_jsx_runtime.jsxs)("span", { children: [
									"无法加载统计数据：",
									error,
									"。请确认 dsh 服务运行正常后重试。"
								] }), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: "dsp-btn",
									style: styles.button,
									onClick: refresh,
									children: "重试"
								})]
							})
						}) : null,
						!hasData && error === null ? (0, react_jsx_runtime.jsx)(SkeletonDashboard, {}) : null,
						hasData ? (0, react_jsx_runtime.jsx)(DashboardBoundary, { children: (0, react_jsx_runtime.jsxs)("div", {
							className: "dsp-fade",
							children: [
								(0, react_jsx_runtime.jsx)(MemoKpiRow, {
									stats,
									prices,
									dayKey
								}),
								(0, react_jsx_runtime.jsx)(MemoChartsRow, { stats }),
								(0, react_jsx_runtime.jsx)(MemoBalancesCard, { refreshKey }),
								(0, react_jsx_runtime.jsx)(MemoDetailsCard, {
									stats,
									prices,
									onPricesChange: applyPrices
								})
							]
						}) }) : null
					]
				})]
			});
		}
		/** First-paint placeholder mirroring the dashboard layout with shimmer blocks. */
		function SkeletonDashboard() {
			return (0, react_jsx_runtime.jsxs)("div", {
				"aria-hidden": true,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						style: styles.kpiGrid,
						children: [
							0,
							1,
							2,
							3,
							4
						].map((i) => (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-skel",
							style: { height: 84 }
						}, i))
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.chartsRow,
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: "dsp-skel",
							style: { height: 330 }
						}), (0, react_jsx_runtime.jsx)("div", {
							className: "dsp-skel",
							style: { height: 330 }
						})]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "dsp-skel",
						style: {
							height: 150,
							marginBottom: 12
						}
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: "dsp-skel",
						style: { height: 280 }
					})
				]
			});
		}
		function KpiRow({ stats, prices, dayKey }) {
			const todayKey = dayKey;
			const yesterdayKey = (/* @__PURE__ */ new Date((/* @__PURE__ */ new Date(`${dayKey}T00:00:00Z`)).getTime() - 864e5)).toISOString().slice(0, 10);
			const today = stats.dailyStats.find((d) => d.date === todayKey);
			const yesterday = stats.dailyStats.find((d) => d.date === yesterdayKey);
			const unconfigured = stats.modelStats.filter((m) => prices[m.model] === void 0).length;
			const totalCost = stats.modelStats.reduce((sum, m) => sum + modelCost(m, prices[m.model]), 0);
			let dayChip;
			if (yesterday !== void 0 && yesterday.totalTokens > 0) {
				const delta = ((today?.totalTokens ?? 0) - yesterday.totalTokens) / yesterday.totalTokens * 100;
				const up = delta >= 0;
				dayChip = (0, react_jsx_runtime.jsx)(TrendChip, {
					text: `较昨日 ${up ? "+" : ""}${delta.toFixed(0)}%`,
					up
				});
			}
			return (0, react_jsx_runtime.jsxs)("div", {
				style: styles.kpiGrid,
				children: [
					(0, react_jsx_runtime.jsx)(KpiCard, {
						accent: COLOR_INPUT,
						icon: (0, react_jsx_runtime.jsx)(IconPulse, { color: COLOR_INPUT }),
						label: "总调用次数",
						value: stats.totalCalls.toLocaleString(),
						sub: today !== void 0 ? `今日 ${today.calls.toLocaleString()} 次` : "今日暂无调用"
					}),
					(0, react_jsx_runtime.jsx)(KpiCard, {
						accent: COLOR_CACHE,
						icon: (0, react_jsx_runtime.jsx)(IconLayers, { color: COLOR_CACHE }),
						label: "总 Token",
						value: formatTokens(stats.totalTokens),
						sub: `输入 ${formatTokens(stats.totalInputTokens)} · 输出 ${formatTokens(stats.totalOutputTokens)}`
					}),
					(0, react_jsx_runtime.jsx)(KpiCard, {
						accent: COLOR_OUTPUT,
						icon: (0, react_jsx_runtime.jsx)(IconClock, { color: COLOR_OUTPUT }),
						label: "今日消耗",
						value: formatTokens(today?.totalTokens ?? 0),
						sub: today !== void 0 ? `输入 ${formatTokens(today.inputTokens)} · 输出 ${formatTokens(today.outputTokens)}` : "今天还没有调用",
						title: "按 UTC 日聚合（与服务端每日统计口径一致）",
						chip: dayChip
					}),
					(0, react_jsx_runtime.jsx)(KpiCard, {
						accent: "#20c997",
						icon: (0, react_jsx_runtime.jsx)(IconTarget, { color: "#20c997" }),
						label: "缓存命中率",
						value: `${stats.cacheHitRate.toFixed(1)}%`,
						sub: `读 ${formatTokens(stats.totalCacheReadTokens)} / 写 ${formatTokens(stats.totalCacheWriteTokens)}`
					}),
					(0, react_jsx_runtime.jsx)(KpiCard, {
						accent: "#ff922b",
						icon: (0, react_jsx_runtime.jsx)(IconCoin, { color: "#ff922b" }),
						label: "估算费用",
						value: formatCny(totalCost),
						sub: unconfigured > 0 ? `${unconfigured} 个模型价格待配置` : "按价格表计算"
					})
				]
			});
		}
		/** Day-over-day delta pill (newapi-style trend chip). */
		function TrendChip({ text, up }) {
			return (0, react_jsx_runtime.jsxs)("span", {
				style: {
					...styles.trendChip,
					color: up ? "#ff922b" : "#51cf66"
				},
				children: [(0, react_jsx_runtime.jsx)("span", {
					style: styles.trendArrow,
					children: up ? "↑" : "↓"
				}), text]
			});
		}
		function KpiCard({ accent, icon, label, value, sub, title, chip }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				style: styles.kpiCard,
				title,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.kpiLabelRow,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								style: {
									...styles.kpiIconChip,
									background: `color-mix(in srgb, ${accent} 16%, transparent)`
								},
								children: icon
							}),
							(0, react_jsx_runtime.jsx)("span", {
								style: styles.kpiLabel,
								children: label
							}),
							chip !== void 0 ? (0, react_jsx_runtime.jsx)("span", {
								style: styles.kpiChipSeat,
								children: chip
							}) : null
						]
					}),
					(0, react_jsx_runtime.jsx)("div", {
						style: styles.kpiValue,
						children: value
					}),
					sub !== void 0 && sub !== "" ? (0, react_jsx_runtime.jsx)("div", {
						style: styles.kpiSub,
						children: sub
					}) : null
				]
			});
		}
		function ChartsRow({ stats }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: "dsp-charts",
				style: styles.chartsRow,
				children: [(0, react_jsx_runtime.jsx)(TrendCard, { stats }), (0, react_jsx_runtime.jsx)(ShareCard, { stats })]
			});
		}
		/** Trend card: stacked input/output/cache bars per calendar bucket. */
		function TrendCard({ stats }) {
			const [period, setPeriod] = (0, react.useState)("day");
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
			const axisMax = niceMax(Math.max(...days.map((d) => d.totalTokens), 1));
			const gridFractions = [
				.25,
				.5,
				.75,
				1
			];
			return (0, react_jsx_runtime.jsxs)("div", {
				style: {
					...styles.card,
					minWidth: 0
				},
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.cardHead,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: styles.cardTitle,
							children: "Token 消耗趋势"
						}), (0, react_jsx_runtime.jsx)("div", {
							style: styles.segmented,
							children: [
								"day",
								"week",
								"month"
							].map((p) => (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-seg",
								style: {
									...styles.segmentButton,
									...p === active ? styles.segmentButtonActive : {}
								},
								disabled: series[p].length === 0,
								onClick: () => {
									setPeriod(p);
								},
								children: labels[p]
							}, p))
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.legendRow,
						children: [
							(0, react_jsx_runtime.jsx)(LegendDot, {
								color: COLOR_INPUT,
								text: "输入"
							}),
							(0, react_jsx_runtime.jsx)(LegendDot, {
								color: COLOR_OUTPUT,
								text: "输出"
							}),
							(0, react_jsx_runtime.jsx)(LegendDot, {
								color: COLOR_CACHE,
								text: "缓存"
							})
						]
					}),
					days.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
						style: styles.muted,
						children: "暂无消耗数据"
					}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", {
						style: styles.plot,
						onMouseLeave: () => {
							setHover(null);
						},
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								style: styles.plotGrid,
								children: gridFractions.map((f) => (0, react_jsx_runtime.jsx)("div", {
									style: {
										...styles.plotLine,
										bottom: `${f * 100}%`
									},
									children: (0, react_jsx_runtime.jsx)("span", {
										style: styles.plotLineLabel,
										children: formatTokens(axisMax * f)
									})
								}, f))
							}),
							(0, react_jsx_runtime.jsx)("div", {
								style: styles.barRow,
								children: days.map((day, i) => {
									const segments = [
										[COLOR_INPUT, day.inputTokens],
										[COLOR_OUTPUT, day.outputTokens],
										[COLOR_CACHE, day.cacheReadTokens + day.cacheWriteTokens]
									];
									return (0, react_jsx_runtime.jsxs)("div", {
										style: styles.barCol,
										children: [(0, react_jsx_runtime.jsx)("div", {
											style: {
												...styles.barZone,
												...hover === i ? styles.barZoneHover : {}
											},
											role: "img",
											"aria-label": `${day.date} · ${formatTokens(day.totalTokens)} tokens · ${day.calls} 次调用`,
											onMouseEnter: () => {
												setHover(i);
											},
											children: segments.map(([color, n]) => (0, react_jsx_runtime.jsx)("div", { style: {
												...styles.barSeg,
												background: color,
												height: `${n / axisMax * 100}%`
											} }, color))
										}), (0, react_jsx_runtime.jsx)("div", {
											style: styles.barLabel,
											children: formatBucketLabel(day.date, active)
										})]
									}, day.date);
								})
							}),
							hover !== null && days[hover] !== void 0 ? (0, react_jsx_runtime.jsx)(TrendTooltip, {
								day: days[hover],
								calls: days[hover].calls,
								left: (hover + .5) / days.length * 100
							}) : null
						]
					}), (0, react_jsx_runtime.jsxs)("div", {
						style: styles.trendFooter,
						children: [
							"范围内合计 ",
							(0, react_jsx_runtime.jsx)("b", { children: formatTokens(days.reduce((s, d) => s + d.totalTokens, 0)) }),
							(0, react_jsx_runtime.jsx)("span", {
								style: styles.trendFooterSep,
								children: "·"
							}),
							days.reduce((s, d) => s + d.calls, 0).toLocaleString(),
							" 次调用",
							(0, react_jsx_runtime.jsx)("span", {
								style: styles.trendFooterSep,
								children: "·"
							}),
							"日均 ",
							formatTokens(days.reduce((s, d) => s + d.totalTokens, 0) / days.length)
						]
					})] })
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
			const clamped = Math.min(85, Math.max(15, left));
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
			return (0, react_jsx_runtime.jsxs)("div", {
				style: {
					...styles.trendTooltip,
					left: `${clamped}%`
				},
				role: "status",
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.trendTooltipTitle,
						children: [
							day.date,
							" · ",
							calls.toLocaleString(),
							" 次调用"
						]
					}),
					rows.map(([label, tokens, color]) => (0, react_jsx_runtime.jsxs)("div", {
						style: styles.trendTooltipRow,
						children: [
							(0, react_jsx_runtime.jsx)("span", { style: {
								...styles.legendDot,
								background: color
							} }),
							(0, react_jsx_runtime.jsx)("span", { children: label }),
							(0, react_jsx_runtime.jsx)("b", {
								style: styles.trendTooltipValue,
								children: formatTokens(tokens)
							})
						]
					}, label)),
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.trendTooltipTotal,
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
			return (0, react_jsx_runtime.jsxs)("span", {
				style: styles.legendItem,
				children: [(0, react_jsx_runtime.jsx)("span", { style: {
					...styles.legendDot,
					background: color
				} }), (0, react_jsx_runtime.jsx)("span", {
					style: styles.legendText,
					children: text
				})]
			});
		}
		/** Share card: donut of total tokens by model with a top-8 legend. */
		function ShareCard({ stats }) {
			const data = [...stats.modelStats].sort((a, b) => b.totalTokens - a.totalTokens);
			const total = data.reduce((sum, m) => sum + m.totalTokens, 0);
			const top = data.slice(0, 8);
			return (0, react_jsx_runtime.jsxs)("div", {
				style: {
					...styles.card,
					minWidth: 0
				},
				children: [(0, react_jsx_runtime.jsx)("div", {
					style: styles.cardHead,
					children: (0, react_jsx_runtime.jsx)("span", {
						style: styles.cardTitle,
						children: "模型使用占比"
					})
				}), top.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
					style: styles.muted,
					children: "暂无模型数据"
				}) : (0, react_jsx_runtime.jsxs)("div", {
					style: styles.shareBody,
					children: [(0, react_jsx_runtime.jsx)("div", {
						style: styles.donutBox,
						children: (0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 42 42",
							width: 168,
							height: 168,
							children: [
								renderDonutArcs(top, total),
								(0, react_jsx_runtime.jsx)("circle", {
									cx: 21,
									cy: 21,
									r: 9.5,
									style: { fill: "var(--dsw-alias-bg-layer-2, #1a1a1a)" }
								}),
								(0, react_jsx_runtime.jsx)("text", {
									x: 21,
									y: 20,
									textAnchor: "middle",
									style: styles.donutValue,
									fill: "var(--dsw-alias-label-primary, #fff)",
									children: formatTokens(total)
								}),
								(0, react_jsx_runtime.jsx)("text", {
									x: 21,
									y: 25,
									textAnchor: "middle",
									style: styles.donutCaption,
									fill: "var(--dsw-alias-label-tertiary, #888)",
									children: "总 Token"
								})
							]
						})
					}), (0, react_jsx_runtime.jsx)("div", {
						style: styles.shareLegend,
						children: top.map((m, i) => (0, react_jsx_runtime.jsxs)("div", {
							style: styles.shareLegendRow,
							title: m.model,
							children: [
								(0, react_jsx_runtime.jsx)("span", { style: {
									...styles.legendDot,
									background: CHART_COLORS[i % CHART_COLORS.length]
								} }),
								(0, react_jsx_runtime.jsx)("span", {
									style: styles.shareModel,
									children: m.model
								}),
								(0, react_jsx_runtime.jsx)("span", {
									style: styles.shareTokens,
									children: formatTokens(m.totalTokens)
								}),
								(0, react_jsx_runtime.jsx)("span", {
									style: styles.sharePct,
									children: total > 0 ? `${(m.totalTokens / total * 100).toFixed(1)}%` : "0%"
								})
							]
						}, m.model))
					})]
				})]
			});
		}
		/** Donut wedges for the top models, drawn as pie paths behind the center hole. */
		function renderDonutArcs(top, total) {
			let angle = -90;
			return top.map((m, i) => {
				const share = total > 0 ? m.totalTokens / total : 0;
				const start = angle;
				const end = angle + share * 360;
				angle = end;
				const startRad = start * Math.PI / 180;
				const endRad = end * Math.PI / 180;
				const r = 16;
				const cx = 21;
				const cy = 21;
				const x1 = cx + r * Math.cos(startRad);
				const y1 = cy + r * Math.sin(startRad);
				const x2 = cx + r * Math.cos(endRad);
				const y2 = cy + r * Math.sin(endRad);
				const large = share > .5 ? 1 : 0;
				return (0, react_jsx_runtime.jsx)("path", {
					d: `M${cx} ${cy} L${x1.toFixed(3)} ${y1.toFixed(3)} A${r} ${r} 0 ${large} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`,
					fill: CHART_COLORS[i % CHART_COLORS.length],
					stroke: "var(--dsw-alias-bg-layer-2, #1a1a1a)",
					strokeWidth: .6
				}, m.model);
			});
		}
		/** Format a millisecond span as "X天 X小时 X分钟" (omitting empty units). */
		function formatDuration(ms) {
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
			/** In-flight balances fetch — aborted when superseded or unmounted. */
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
			const rows = [...balances];
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
			return (0, react_jsx_runtime.jsxs)("div", {
				style: styles.card,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					style: styles.cardHead,
					children: [(0, react_jsx_runtime.jsx)("span", {
						style: styles.cardTitle,
						children: "渠道余量 / 余额"
					}), (0, react_jsx_runtime.jsxs)("span", {
						style: styles.cardHeadRight,
						children: [loading ? (0, react_jsx_runtime.jsx)("span", {
							style: styles.mutedInline,
							children: "查询中…"
						}) : null, (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsp-btn",
							style: styles.button,
							onClick: () => {
								load("foreground");
							},
							disabled: loading,
							children: "刷新"
						})]
					})]
				}), (0, react_jsx_runtime.jsx)("div", {
					style: styles.balanceGrid,
					children: rows.map((row) => (0, react_jsx_runtime.jsx)(BalanceRowCard, {
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
				})]
			});
		}
		function BalanceRowCard({ row, editing, draftNote, onEdit, onCancel, onDraft, onSave }) {
			const ok = row.error === void 0 && row.kind !== "manual";
			const statusColor = row.error !== void 0 ? "#ff6b6b" : ok ? "#51cf66" : "#ffd43b";
			return (0, react_jsx_runtime.jsxs)("div", {
				style: styles.balanceCard,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					style: styles.balanceHead,
					children: [(0, react_jsx_runtime.jsx)("span", { style: {
						...styles.statusDot,
						background: statusColor
					} }), (0, react_jsx_runtime.jsx)("span", {
						style: styles.balanceName,
						title: row.channel,
						children: row.displayName
					})]
				}), row.error !== void 0 ? (0, react_jsx_runtime.jsx)("div", {
					style: styles.balanceError,
					children: row.error
				}) : row.kind === "balance" ? (0, react_jsx_runtime.jsxs)("div", { children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.balanceValue,
						children: [row.currency === "CNY" ? "¥" : row.currency === "USD" ? "$" : "", row.balance ?? "—"]
					}),
					row.note !== void 0 ? (0, react_jsx_runtime.jsx)("div", {
						style: styles.balanceNote,
						children: row.note
					}) : null,
					row.fetchedAt !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
						style: styles.mutedInline,
						children: ["查询于 ", new Date(row.fetchedAt).toLocaleTimeString()]
					}) : null
				] }) : row.kind === "plan" && row.quota !== void 0 ? (0, react_jsx_runtime.jsx)("div", { children: row.quota.map((q) => {
					const remainingMs = q.resetsAt !== "" ? new Date(q.resetsAt).getTime() - Date.now() : 0;
					const percent = Math.min(100, Math.max(0, q.percent));
					return (0, react_jsx_runtime.jsxs)("div", {
						style: styles.quotaRow,
						title: `重置于 ${q.resetsAt}`,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							style: styles.quotaTop,
							children: [(0, react_jsx_runtime.jsx)("span", {
								style: styles.quotaLabel,
								children: q.label
							}), (0, react_jsx_runtime.jsxs)("span", {
								style: styles.quotaText,
								children: [q.used !== void 0 && q.limit !== void 0 ? `${formatTokens(q.used)} / ${formatTokens(q.limit)} · ${q.percent}%` : `${q.percent}%`, q.resetsAt !== "" ? ` · 剩余 ${formatDuration(remainingMs)}` : ""]
							})]
						}), (0, react_jsx_runtime.jsx)("div", {
							style: styles.quotaBar,
							children: (0, react_jsx_runtime.jsx)("span", { style: {
								...styles.quotaFill,
								width: `${percent}%`,
								background: quotaColor(percent)
							} })
						})]
					}, q.label);
				}) }) : row.kind === "plan" && row.usage !== void 0 ? (0, react_jsx_runtime.jsx)("div", { children: row.usage.map((u) => (0, react_jsx_runtime.jsx)("div", {
					style: styles.quotaRow,
					children: (0, react_jsx_runtime.jsxs)("div", {
						style: styles.quotaTop,
						children: [(0, react_jsx_runtime.jsx)("span", {
							style: styles.quotaLabel,
							children: u.label
						}), (0, react_jsx_runtime.jsxs)("span", {
							style: styles.quotaText,
							children: [
								"输入 ",
								formatTokens(u.inputTokens),
								" · 输出 ",
								formatTokens(u.outputTokens)
							]
						})]
					})
				}, u.label)) }) : (0, react_jsx_runtime.jsxs)("div", { children: [editing === row.channel ? (0, react_jsx_runtime.jsxs)("div", {
					style: styles.manualEdit,
					children: [
						(0, react_jsx_runtime.jsx)("input", {
							className: "dsp-input",
							style: styles.input,
							type: "text",
							placeholder: "如：剩余 18天 3小时 或 4100M Credits",
							value: draftNote,
							onChange: (e) => {
								onDraft(e.target.value);
							}
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsp-btn-p",
							style: styles.buttonPrimary,
							onClick: () => {
								onSave(row.channel);
							},
							children: "保存"
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsp-btn",
							style: styles.button,
							onClick: onCancel,
							children: "取消"
						})
					]
				}) : (0, react_jsx_runtime.jsxs)("div", {
					style: styles.manualRow,
					children: [(0, react_jsx_runtime.jsx)("span", {
						style: styles.balanceValue,
						children: row.note !== void 0 && row.note !== "" ? row.note : "待配置"
					}), (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: "dsp-btn",
						style: styles.button,
						onClick: () => {
							onEdit(row.channel);
						},
						children: row.note !== void 0 && row.note !== "" ? "修改" : "配置"
					})]
				}), (0, react_jsx_runtime.jsx)("div", {
					style: styles.mutedInline,
					children: "无公开查询 API，请到平台控制台查看后填写"
				})] })]
			});
		}
		/** Quota bar color: green when plenty remains, amber → red as usage climbs. */
		function quotaColor(percent) {
			if (percent >= 90) return "#ff6b6b";
			if (percent >= 70) return "#ff922b";
			return "#51cf66";
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
				id: "prices",
				label: "模型价格"
			},
			{
				id: "records",
				label: "调用记录"
			}
		];
		/** Tabbed detail card: usage tables, price editor and recent records. */
		function DetailsCard({ stats, prices, onPricesChange }) {
			const [tab, setTab] = (0, react.useState)("models");
			/** `null` = not editing; editing keeps a string draft so decimals type naturally. */
			const [draft, setDraft] = (0, react.useState)(null);
			const editing = draft !== null;
			const applyDraft = () => {
				if (draft !== null) onPricesChange(draftToPrices(draft));
				setDraft(null);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				style: styles.card,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						style: styles.cardHead,
						children: [(0, react_jsx_runtime.jsx)("div", {
							style: styles.segmented,
							children: DETAIL_TABS.map((t) => (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-seg",
								style: {
									...styles.segmentButton,
									...t.id === tab ? styles.segmentButtonActive : {}
								},
								onClick: () => {
									setTab(t.id);
								},
								children: t.label
							}, t.id))
						}), tab === "prices" ? editing ? (0, react_jsx_runtime.jsxs)("span", {
							style: styles.cardHeadRight,
							children: [(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn",
								style: styles.button,
								onClick: () => {
									setDraft(null);
								},
								children: "取消"
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: "dsp-btn-p",
								style: styles.buttonPrimary,
								onClick: applyDraft,
								children: "保存"
							})]
						}) : (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: "dsp-btn",
							style: styles.button,
							onClick: () => {
								setDraft(toPriceDraft(prices));
							},
							children: "编辑价格"
						}) : null]
					}),
					tab === "models" ? (0, react_jsx_runtime.jsx)(ModelTable, {
						data: stats.modelStats,
						prices
					}) : null,
					tab === "channels" ? (0, react_jsx_runtime.jsx)(ChannelTable, { data: stats.channelStats }) : null,
					tab === "prices" ? (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsxs)("p", {
						style: styles.hint,
						children: [
							"内置价格为官方牌价（人民币 元/1M tokens；美元模型按 ≈7.1 汇率折算），来源与生效时间见",
							(0, react_jsx_runtime.jsx)("a", {
								href: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
								target: "_blank",
								rel: "noreferrer",
								style: styles.link,
								children: " DeepSeek"
							}),
							"、",
							(0, react_jsx_runtime.jsx)("a", {
								href: "https://developers.openai.com/api/docs/pricing",
								target: "_blank",
								rel: "noreferrer",
								style: styles.link,
								children: " OpenAI"
							}),
							"、",
							(0, react_jsx_runtime.jsx)("a", {
								href: "https://www.anthropic.com/claude/opus/5",
								target: "_blank",
								rel: "noreferrer",
								style: styles.link,
								children: " Anthropic"
							}),
							" 等官方页。 你编辑过的模型以你的价格为准；缺失模型自动用内置默认价补齐。 套餐内模型（MiMo Token Plan）与免费模型（ox-alpha-free 等）计 0，避免与套餐/免费额度重复计费； DeepSeek 官方为峰谷计价（周一至五 9-12/14-18 为高峰），内置取高峰价、空闲时段实际减半； 中转站实际扣费可能低于牌价（如 Sub2API 折扣），估算值会偏高。"
						]
					}), editing && draft !== null ? (0, react_jsx_runtime.jsx)(PriceEditor, {
						draft,
						onChange: setDraft,
						models: stats.modelStats.map((m) => m.model)
					}) : (0, react_jsx_runtime.jsx)(PriceTableCard, {
						rows: stats.modelStats.map((m) => m.model),
						prices
					})] }) : null,
					tab === "records" ? (0, react_jsx_runtime.jsx)(RecordsTable, {
						data: stats.recentRecords,
						prices
					}) : null
				]
			});
		}
		function ModelTable({ data, prices }) {
			if (data.length === 0) return (0, react_jsx_runtime.jsx)("p", {
				style: styles.muted,
				children: "暂无模型数据"
			});
			const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens);
			const total = sorted.reduce((sum, m) => sum + m.totalTokens, 0);
			return (0, react_jsx_runtime.jsx)("div", {
				style: styles.tableScroll,
				children: (0, react_jsx_runtime.jsxs)("table", {
					className: "dsp-table",
					style: styles.table,
					children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.th,
							children: "模型"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.th,
							children: "占比"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "调用"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输入"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输出"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "缓存读"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "缓存写"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "总 Token"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "费用"
						})
					] }) }), (0, react_jsx_runtime.jsx)("tbody", { children: sorted.map((m, i) => {
						const share = total > 0 ? m.totalTokens / total * 100 : 0;
						return (0, react_jsx_runtime.jsxs)("tr", { children: [
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.td,
								title: m.model,
								children: m.model
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.td,
								children: (0, react_jsx_runtime.jsxs)("span", {
									className: "dsp-sharebar",
									style: styles.sharebar,
									children: [(0, react_jsx_runtime.jsx)("span", {
										style: styles.sharebarTrack,
										children: (0, react_jsx_runtime.jsx)("span", { style: {
											...styles.sharebarFill,
											width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
											background: CHART_COLORS[i % CHART_COLORS.length]
										} })
									}), (0, react_jsx_runtime.jsxs)("span", {
										style: styles.sharebarText,
										children: [share.toFixed(1), "%"]
									})]
								})
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: m.calls.toLocaleString()
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(m.inputTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(m.outputTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(m.cacheReadTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(m.cacheWriteTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(m.totalTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: {
									...styles.tdRight,
									color: "var(--dsw-alias-state-warn-label, #ffd43b)"
								},
								children: formatCny(modelCost(m, prices[m.model]))
							})
						] }, m.model);
					}) })]
				})
			});
		}
		function ChannelTable({ data }) {
			if (data.length === 0) return (0, react_jsx_runtime.jsx)("p", {
				style: styles.muted,
				children: "暂无渠道数据"
			});
			const sorted = [...data].sort((a, b) => b.totalTokens - a.totalTokens);
			const total = sorted.reduce((sum, c) => sum + c.totalTokens, 0);
			return (0, react_jsx_runtime.jsx)("div", {
				style: styles.tableScroll,
				children: (0, react_jsx_runtime.jsxs)("table", {
					className: "dsp-table",
					style: styles.table,
					children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.th,
							children: "渠道"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.th,
							children: "占比"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "调用"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输入"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输出"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "缓存"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "总 Token"
						})
					] }) }), (0, react_jsx_runtime.jsx)("tbody", { children: sorted.map((c, i) => {
						const share = total > 0 ? c.totalTokens / total * 100 : 0;
						return (0, react_jsx_runtime.jsxs)("tr", { children: [
							(0, react_jsx_runtime.jsxs)("td", {
								style: styles.td,
								children: [(0, react_jsx_runtime.jsx)("div", {
									style: styles.channelName,
									children: channelName(c.channel)
								}), (0, react_jsx_runtime.jsx)("div", {
									style: styles.channelModels,
									title: c.models.join(", "),
									children: c.models.join(", ")
								})]
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.td,
								children: (0, react_jsx_runtime.jsxs)("span", {
									className: "dsp-sharebar",
									style: styles.sharebar,
									children: [(0, react_jsx_runtime.jsx)("span", {
										style: styles.sharebarTrack,
										children: (0, react_jsx_runtime.jsx)("span", { style: {
											...styles.sharebarFill,
											width: `${Math.max(share, share > 0 ? 2 : 0)}%`,
											background: CHART_COLORS[i % CHART_COLORS.length]
										} })
									}), (0, react_jsx_runtime.jsxs)("span", {
										style: styles.sharebarText,
										children: [share.toFixed(1), "%"]
									})]
								})
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: c.calls.toLocaleString()
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(c.inputTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(c.outputTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(c.cacheReadTokens + c.cacheWriteTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(c.totalTokens)
							})
						] }, c.channel);
					}) })]
				})
			});
		}
		function RecordsTable({ data, prices }) {
			if (data.length === 0) return (0, react_jsx_runtime.jsx)("p", {
				style: styles.muted,
				children: "暂无调用记录（历史明细已折叠为总量统计，各项数字不受影响）"
			});
			return (0, react_jsx_runtime.jsx)("div", {
				style: styles.tableScroll,
				children: (0, react_jsx_runtime.jsx)("div", {
					style: styles.recordsScroll,
					children: (0, react_jsx_runtime.jsxs)("table", {
						className: "dsp-table",
						style: styles.table,
						children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.th,
								children: "时间"
							}),
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.th,
								children: "渠道"
							}),
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.th,
								children: "模型"
							}),
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.thRight,
								children: "输入"
							}),
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.thRight,
								children: "输出"
							}),
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.thRight,
								children: "缓存"
							}),
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.thRight,
								children: "总 Token"
							}),
							(0, react_jsx_runtime.jsx)("th", {
								style: styles.thRight,
								children: "费用"
							})
						] }) }), (0, react_jsx_runtime.jsx)("tbody", { children: data.slice(0, 100).map((r, i) => (0, react_jsx_runtime.jsxs)("tr", { children: [
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.td,
								children: new Date(r.ts).toLocaleString()
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.td,
								children: channelName(r.provider)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.td,
								title: r.model,
								children: r.model
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(r.inputTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(r.outputTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(r.cacheReadTokens + r.cacheWriteTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatTokens(r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens)
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: formatCny(modelCost({
									model: r.model,
									calls: 1,
									inputTokens: r.inputTokens,
									outputTokens: r.outputTokens,
									cacheReadTokens: r.cacheReadTokens,
									cacheWriteTokens: r.cacheWriteTokens,
									reasoningTokens: r.reasoningTokens,
									totalTokens: r.inputTokens + r.outputTokens + r.cacheReadTokens + r.cacheWriteTokens
								}, prices[r.model]))
							})
						] }, `${r.sessionId}-${i}`)) })]
					})
				})
			});
		}
		const PRICE_FIELDS = [
			"inputPerM",
			"outputPerM",
			"cacheReadPerM",
			"cacheWritePerM"
		];
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
		function PriceTableCard({ rows, prices }) {
			if (rows.length === 0) return (0, react_jsx_runtime.jsx)("p", {
				style: styles.muted,
				children: "暂无模型数据"
			});
			return (0, react_jsx_runtime.jsx)("div", {
				style: styles.tableScroll,
				children: (0, react_jsx_runtime.jsxs)("table", {
					className: "dsp-table",
					style: styles.table,
					children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.th,
							children: "模型"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输入 元/1M"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输出 元/1M"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "缓存命中 元/1M"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "缓存写入 元/1M"
						})
					] }) }), (0, react_jsx_runtime.jsx)("tbody", { children: rows.map((model) => {
						const p = prices[model];
						return (0, react_jsx_runtime.jsxs)("tr", { children: [(0, react_jsx_runtime.jsx)("td", {
							style: styles.td,
							title: model,
							children: model
						}), p === void 0 ? (0, react_jsx_runtime.jsx)("td", {
							style: styles.td,
							colSpan: 4,
							children: (0, react_jsx_runtime.jsx)("span", {
								style: styles.pending,
								children: "价格待配置（不计入费用）"
							})
						}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: p.inputPerM
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: p.outputPerM
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: p.cacheReadPerM
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: p.cacheWritePerM
							})
						] })] }, model);
					}) })]
				})
			});
		}
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
			return (0, react_jsx_runtime.jsx)("div", {
				style: styles.tableScroll,
				children: (0, react_jsx_runtime.jsxs)("table", {
					className: "dsp-table",
					style: styles.table,
					children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.th,
							children: "模型"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输入 元/1M"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "输出 元/1M"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "缓存命中 元/1M"
						}),
						(0, react_jsx_runtime.jsx)("th", {
							style: styles.thRight,
							children: "缓存写入 元/1M"
						})
					] }) }), (0, react_jsx_runtime.jsx)("tbody", { children: models.map((model) => {
						const p = draft[model] ?? {
							inputPerM: "0",
							outputPerM: "0",
							cacheReadPerM: "0",
							cacheWritePerM: "0"
						};
						return (0, react_jsx_runtime.jsxs)("tr", { children: [
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.td,
								title: model,
								children: model
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: (0, react_jsx_runtime.jsx)("input", {
									className: "dsp-input",
									style: styles.input,
									type: "number",
									step: "0.001",
									min: "0",
									value: p.inputPerM,
									onChange: (e) => {
										set(model, "inputPerM", e.target.value);
									}
								})
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: (0, react_jsx_runtime.jsx)("input", {
									className: "dsp-input",
									style: styles.input,
									type: "number",
									step: "0.001",
									min: "0",
									value: p.outputPerM,
									onChange: (e) => {
										set(model, "outputPerM", e.target.value);
									}
								})
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: (0, react_jsx_runtime.jsx)("input", {
									className: "dsp-input",
									style: styles.input,
									type: "number",
									step: "0.001",
									min: "0",
									value: p.cacheReadPerM,
									onChange: (e) => {
										set(model, "cacheReadPerM", e.target.value);
									}
								})
							}),
							(0, react_jsx_runtime.jsx)("td", {
								style: styles.tdRight,
								children: (0, react_jsx_runtime.jsx)("input", {
									className: "dsp-input",
									style: styles.input,
									type: "number",
									step: "0.001",
									min: "0",
									value: p.cacheWritePerM,
									onChange: (e) => {
										set(model, "cacheWritePerM", e.target.value);
									}
								})
							})
						] }, model);
					}) })]
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
		/**
		* Hover/focus affordances and responsive collapse that inline styles cannot
		* express. All selectors are scoped under `.dsp-` classes owned by this view.
		*/
		const dashboardCss = `
.dsp-btn:hover:not(:disabled), .dsp-btn-p:hover:not(:disabled) { filter: brightness(1.2); }
.dsp-btn:disabled, .dsp-btn-p:disabled { opacity: 0.5; cursor: default; }
.dsp-table tbody tr:hover td { background: var(--dsw-alias-interactive-bg-hover, rgba(128,128,128,0.08)); }
.dsp-seg:hover:not(:disabled) { color: var(--dsw-alias-label-primary, #fff); }
.dsp-input:focus { outline: none; border-color: var(--dsw-alias-state-business-primary, #4a9eff); }
@keyframes dspShimmer { from { background-position: 400px 0; } to { background-position: -400px 0; } }
.dsp-skel {
  background: linear-gradient(90deg,
    var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.08)) 25%,
    rgba(128,128,128,0.2) 50%,
    var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.08)) 75%);
  background-size: 800px 100%;
  animation: dspShimmer 1.2s linear infinite;
  border-radius: 12px;
}
@keyframes dspSpin { to { transform: rotate(360deg); } }
.dsp-spin { display: inline-block; animation: dspSpin 0.9s linear infinite; }
@keyframes dspFade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
.dsp-fade { animation: dspFade 0.25s ease; }
@media (prefers-reduced-motion: reduce) {
  .dsp-skel, .dsp-spin, .dsp-fade { animation: none; }
}
@media (max-width: 980px) {
  .dsp-charts { grid-template-columns: 1fr !important; }
}
`;
		const card = {
			background: "var(--dsw-alias-bg-layer-2, rgba(128,128,128,0.06))",
			border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.22))",
			borderRadius: 12,
			padding: 16
		};
		const buttonBase = {
			padding: "4px 12px",
			borderRadius: 6,
			border: "1px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.3))",
			background: "transparent",
			color: "var(--dsw-alias-label-primary, #eee)",
			cursor: "pointer",
			fontSize: 12,
			lineHeight: "18px"
		};
		const segmentButton = {
			padding: "4px 12px",
			borderRadius: 6,
			border: "none",
			background: "transparent",
			color: "var(--dsw-alias-label-secondary, #999)",
			cursor: "pointer",
			fontSize: 12,
			lineHeight: "18px",
			whiteSpace: "nowrap"
		};
		const styles = {
			page: {
				height: "100%",
				minHeight: 0,
				overflowY: "auto",
				boxSizing: "border-box",
				background: "var(--dsw-alias-bg-layer-1, transparent)"
			},
			frame: {
				maxWidth: 1280,
				margin: "0 auto",
				padding: "20px 24px 40px",
				boxSizing: "border-box"
			},
			head: {
				display: "flex",
				alignItems: "flex-end",
				justifyContent: "space-between",
				gap: 12,
				marginBottom: 14,
				flexWrap: "wrap"
			},
			headTitle: {
				fontSize: 20,
				fontWeight: 700,
				color: "var(--dsw-alias-label-primary, #fff)"
			},
			headSub: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary, #999)",
				marginTop: 3
			},
			headActions: {
				display: "flex",
				alignItems: "center",
				gap: 10
			},
			headUpdated: {
				fontSize: 12,
				color: "var(--dsw-alias-label-tertiary, #888)"
			},
			headError: {
				fontSize: 12,
				color: "#ff6b6b"
			},
			buttonGlyph: {
				display: "inline-block",
				marginRight: 4
			},
			button: buttonBase,
			buttonPrimary: {
				...buttonBase,
				border: "1px solid var(--dsw-alias-state-business-primary, #4a9eff)",
				background: "var(--dsw-alias-state-business-primary, #4a9eff)",
				color: "#fff"
			},
			kpiGrid: {
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
				gap: 12,
				marginBottom: 12
			},
			kpiCard: {
				...card,
				padding: "12px 14px"
			},
			kpiLabelRow: {
				display: "flex",
				alignItems: "center",
				gap: 8
			},
			kpiIconChip: {
				width: 26,
				height: 26,
				borderRadius: 8,
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				flexShrink: 0
			},
			kpiChipSeat: { marginLeft: "auto" },
			kpiLabel: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary, #999)"
			},
			kpiValue: {
				fontSize: 24,
				fontWeight: 700,
				marginTop: 8,
				color: "var(--dsw-alias-label-primary, #fff)",
				fontVariantNumeric: "tabular-nums"
			},
			kpiSub: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #888)",
				marginTop: 3
			},
			trendChip: {
				display: "inline-flex",
				alignItems: "center",
				gap: 2,
				fontSize: 11,
				fontWeight: 600,
				fontVariantNumeric: "tabular-nums",
				whiteSpace: "nowrap"
			},
			trendArrow: { fontSize: 10 },
			chartsRow: {
				display: "grid",
				gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
				gap: 12,
				marginBottom: 12
			},
			card,
			cardHead: {
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				gap: 8,
				marginBottom: 10,
				flexWrap: "wrap"
			},
			cardHeadRight: {
				display: "flex",
				alignItems: "center",
				gap: 8
			},
			cardTitle: {
				fontSize: 14,
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary, #fff)"
			},
			segmented: {
				display: "inline-flex",
				gap: 2,
				padding: 2,
				borderRadius: 8,
				background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.1))",
				border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.15))"
			},
			segmentButton,
			segmentButtonActive: {
				background: "var(--dsw-alias-interactive-bg-hover-solid, rgba(128,128,128,0.22))",
				color: "var(--dsw-alias-label-primary, #fff)",
				borderRadius: 6
			},
			legendRow: {
				display: "flex",
				gap: 14,
				marginBottom: 6
			},
			legendItem: {
				display: "inline-flex",
				alignItems: "center",
				gap: 5
			},
			legendDot: {
				width: 9,
				height: 9,
				borderRadius: 2,
				flexShrink: 0,
				display: "inline-block"
			},
			legendText: {
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary, #999)"
			},
			plot: {
				position: "relative",
				height: 240
			},
			plotGrid: {
				position: "absolute",
				inset: "18px 0 22px 0"
			},
			plotLine: {
				position: "absolute",
				left: 0,
				right: 0,
				borderBottom: "1px dashed var(--dsw-alias-border-l1, rgba(128,128,128,0.18))"
			},
			plotLineLabel: {
				position: "absolute",
				left: 0,
				top: -14,
				fontSize: 10,
				color: "var(--dsw-alias-label-tertiary, #777)",
				fontVariantNumeric: "tabular-nums"
			},
			barRow: {
				position: "absolute",
				inset: "18px 0 22px 0",
				display: "flex",
				gap: 6,
				alignItems: "stretch"
			},
			barCol: {
				flex: 1,
				minWidth: 0,
				display: "flex",
				flexDirection: "column"
			},
			barZone: {
				flex: 1,
				display: "flex",
				flexDirection: "column-reverse",
				alignItems: "stretch",
				borderRadius: 3,
				overflow: "hidden"
			},
			barSeg: { width: "100%" },
			barZoneHover: { filter: "brightness(1.15)" },
			trendTooltip: {
				position: "absolute",
				top: 6,
				transform: "translateX(-50%)",
				zIndex: 5,
				pointerEvents: "none",
				background: "var(--dsw-alias-bg-layer-2, #1f1f1f)",
				border: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.25))",
				borderRadius: 8,
				padding: "7px 10px",
				boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary, #999)",
				whiteSpace: "nowrap"
			},
			trendTooltipTitle: {
				color: "var(--dsw-alias-label-primary, #fff)",
				fontWeight: 600,
				marginBottom: 4
			},
			trendTooltipRow: {
				display: "flex",
				alignItems: "center",
				gap: 5,
				margin: "1px 0"
			},
			trendTooltipValue: {
				marginLeft: "auto",
				paddingLeft: 8,
				color: "var(--dsw-alias-label-primary, #fff)",
				fontVariantNumeric: "tabular-nums"
			},
			trendTooltipTotal: {
				marginTop: 3,
				paddingTop: 3,
				borderTop: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.18))",
				color: "var(--dsw-alias-label-primary, #eee)"
			},
			barLabel: {
				height: 22,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: 10,
				color: "var(--dsw-alias-label-tertiary, #888)",
				whiteSpace: "nowrap",
				overflow: "hidden"
			},
			trendFooter: {
				marginTop: 8,
				paddingTop: 8,
				borderTop: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.14))",
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary, #999)",
				display: "flex",
				alignItems: "baseline",
				gap: 6,
				flexWrap: "wrap",
				fontVariantNumeric: "tabular-nums"
			},
			trendFooterSep: { color: "var(--dsw-alias-label-tertiary, #777)" },
			shareBody: {
				display: "flex",
				gap: 14,
				alignItems: "center",
				flexWrap: "wrap"
			},
			donutBox: { flexShrink: 0 },
			donutValue: {
				fontSize: 7.5,
				fontWeight: 700
			},
			donutCaption: { fontSize: 3.6 },
			shareLegend: {
				flex: 1,
				minWidth: 150,
				display: "flex",
				flexDirection: "column",
				gap: 6
			},
			shareLegendRow: {
				display: "flex",
				alignItems: "center",
				gap: 6,
				fontSize: 12,
				minWidth: 0
			},
			shareModel: {
				color: "var(--dsw-alias-label-primary, #fff)",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			shareTokens: {
				marginLeft: "auto",
				color: "var(--dsw-alias-label-secondary, #999)",
				fontVariantNumeric: "tabular-nums",
				flexShrink: 0
			},
			sharePct: {
				color: "var(--dsw-alias-label-tertiary, #888)",
				fontVariantNumeric: "tabular-nums",
				flexShrink: 0,
				width: 44,
				textAlign: "right"
			},
			balanceGrid: {
				display: "grid",
				gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
				gap: 10
			},
			balanceCard: {
				background: "var(--dsw-alias-bg-layer-1, rgba(128,128,128,0.05))",
				border: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.16))",
				borderRadius: 10,
				padding: "10px 12px",
				minWidth: 0
			},
			balanceHead: {
				display: "flex",
				alignItems: "center",
				gap: 7,
				marginBottom: 6
			},
			statusDot: {
				width: 7,
				height: 7,
				borderRadius: "50%",
				flexShrink: 0
			},
			balanceName: {
				fontSize: 12,
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary, #fff)",
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			balanceValue: {
				fontSize: 18,
				fontWeight: 700,
				color: "var(--dsw-alias-label-primary, #fff)",
				fontVariantNumeric: "tabular-nums",
				marginRight: 8
			},
			balanceError: {
				fontSize: 12,
				color: "#ff6b6b",
				wordBreak: "break-all"
			},
			balanceNote: {
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary, #999)",
				marginTop: 2,
				lineHeight: 1.5,
				wordBreak: "break-word"
			},
			quotaRow: { margin: "6px 0" },
			quotaTop: {
				display: "flex",
				alignItems: "baseline",
				justifyContent: "space-between",
				gap: 8,
				marginBottom: 3
			},
			quotaLabel: {
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary, #999)",
				flexShrink: 0
			},
			quotaText: {
				fontSize: 11,
				color: "var(--dsw-alias-label-primary, #eee)",
				fontVariantNumeric: "tabular-nums",
				textAlign: "right"
			},
			quotaBar: {
				height: 6,
				borderRadius: 3,
				background: "var(--dsw-alias-border-l1, rgba(128,128,128,0.18))",
				overflow: "hidden"
			},
			quotaFill: {
				display: "block",
				height: "100%",
				borderRadius: 3,
				transition: "width 0.3s ease"
			},
			manualRow: {
				display: "flex",
				alignItems: "center",
				flexWrap: "wrap",
				gap: 6
			},
			manualEdit: {
				display: "flex",
				gap: 6,
				alignItems: "center",
				flexWrap: "wrap",
				marginBottom: 4
			},
			table: {
				width: "100%",
				borderCollapse: "collapse",
				fontSize: 12
			},
			sharebar: {
				display: "inline-flex",
				alignItems: "center",
				gap: 8,
				minWidth: 0,
				maxWidth: 160,
				width: "100%"
			},
			sharebarTrack: {
				flex: 1,
				height: 5,
				borderRadius: 3,
				background: "var(--dsw-alias-border-l1, rgba(128,128,128,0.18))",
				overflow: "hidden",
				minWidth: 24
			},
			sharebarFill: {
				display: "block",
				height: "100%",
				borderRadius: 3
			},
			sharebarText: {
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary, #999)",
				fontVariantNumeric: "tabular-nums",
				flexShrink: 0,
				width: 42,
				textAlign: "right"
			},
			th: {
				padding: "7px 8px",
				textAlign: "left",
				borderBottom: "1px solid var(--dsw-alias-border-l2, rgba(128,128,128,0.22))",
				color: "var(--dsw-alias-label-tertiary, #888)",
				fontWeight: 500,
				fontSize: 11,
				whiteSpace: "nowrap"
			},
			td: {
				padding: "7px 8px",
				borderBottom: "1px solid var(--dsw-alias-border-l1, rgba(128,128,128,0.14))",
				color: "var(--dsw-alias-label-primary, #eee)",
				maxWidth: 220,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			tableScroll: {
				overflowX: "auto",
				maxWidth: "100%"
			},
			recordsScroll: {
				maxHeight: 360,
				overflowY: "auto"
			},
			channelName: {
				fontSize: 12,
				fontWeight: 600,
				color: "var(--dsw-alias-label-primary, #fff)"
			},
			channelModels: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #888)",
				maxWidth: 200,
				overflow: "hidden",
				textOverflow: "ellipsis",
				whiteSpace: "nowrap"
			},
			hint: {
				fontSize: 11,
				color: "var(--dsw-alias-label-secondary, #999)",
				margin: "4px 0 10px",
				lineHeight: 1.6
			},
			link: { color: "var(--dsw-alias-state-business-primary, #4a9eff)" },
			muted: {
				fontSize: 12,
				color: "var(--dsw-alias-label-secondary, #999)",
				margin: "10px 0"
			},
			mutedInline: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #888)"
			},
			error: {
				fontSize: 12,
				color: "#ff6b6b",
				margin: "10px 0",
				display: "flex",
				alignItems: "center",
				gap: 10,
				flexWrap: "wrap"
			},
			pending: {
				color: "#ffd43b",
				fontSize: 11
			},
			input: {
				width: 84,
				padding: "3px 6px",
				borderRadius: 5,
				border: "1px solid var(--dsw-alias-border-l3, rgba(128,128,128,0.3))",
				background: "var(--dsw-alias-bg-base, rgba(0,0,0,0.2))",
				color: "var(--dsw-alias-label-primary, #fff)",
				fontSize: 12,
				boxSizing: "border-box"
			}
		};
		styles.thRight = {
			...styles.th,
			textAlign: "right",
			fontVariantNumeric: "tabular-nums"
		};
		styles.tdRight = {
			...styles.td,
			textAlign: "right",
			fontVariantNumeric: "tabular-nums"
		};
		//#endregion
		//#region lib/types/client/index.js
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