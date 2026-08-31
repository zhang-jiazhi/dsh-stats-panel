import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
//#region src/index.ts
/** Stable cordis plugin name. */
const name = "stats-panel";
/** Services required before the stats surfaces can mount. */
const inject = ["webServer"];
/** Where the durable usage log lives. */
const DATA_DIR = join(homedir(), ".dsh", "stats-panel");
const RECORDS_FILE = join(DATA_DIR, "records.jsonl");
/**
* Compacted aggregates — the sole store of the folded detail prefix. Rows
* folded into the archive are not kept individually; rows at/after `cutoffTs`
* remain in records.jsonl. The cutoff is applied while loading and collecting,
* so a crash between the two writes can never double-count (see compactRecords).
*/
const ARCHIVE_FILE = join(DATA_DIR, "archive.json");
/** Persisted session revisions used to skip unchanged backfill work. */
const BACKFILL_STATE_FILE = join(DATA_DIR, "backfill-state.json");
/** Default compaction trigger (records in memory). */
const COMPACT_MAX_RECORDS_DEFAULT = 1e4;
/**
* Ceiling for one channel probe inside a balances round (ms). Individual
* adapters allow up to 20s + one retry, so without this ceiling a single slow
* upstream could hold the whole round — and the browser's spinner — for ~40s.
* Override with DSH_STATS_BALANCE_DEADLINE_MS.
*/
const BALANCE_PROBE_DEADLINE_MS_DEFAULT = 12e3;
/** MiMo 平台控制台登录 Cookie 文件（用于自动查询 Token Plan 套餐用量）。 */
const MIMO_COOKIE_FILE = join(DATA_DIR, "mimo-cookie.txt");
/** The loopback hostnames a request's `Host` header may name. */
const LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set([
	"127.0.0.1",
	"localhost",
	"::1"
]);
/** Canonicalize URL hostnames for case-insensitive and bracketed IPv6 comparison. */
function normalizeHostname(hostname) {
	const lower = hostname.toLowerCase();
	return lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
}
/** Whether `address` is a loopback peer literal. */
function isLoopbackAddress(address) {
	return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
/**
* Strip an IPv4-mapped IPv6 prefix so `::ffff:192.168.1.9` compares as the
* IPv4 literal Node would have reported on an IPv4 socket.
*/
function normalizePeer(address) {
	return address.startsWith("::ffff:") ? address.slice(7) : address;
}
/**
* Whether `address` sits in a private (non-routable) range: RFC1918 IPv4,
* IPv4 link-local, IPv6 unique-local (fc00::/7) or IPv6 link-local (fe80::/10).
* A public address is never treated as LAN, so exposing the port to the
* internet cannot silently widen who may read usage data.
*/
function isPrivateAddress(address) {
	const peer = normalizePeer(address).toLowerCase();
	const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/.exec(peer);
	if (v4 !== null) {
		const [a, b] = [Number(v4[1]), Number(v4[2])];
		if (a === 10) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 169 && b === 254) return true;
		return false;
	}
	if (peer.startsWith("fe8") || peer.startsWith("fe9") || peer.startsWith("fea") || peer.startsWith("feb")) return true;
	return peer.startsWith("fc") || peer.startsWith("fd");
}
/**
* Whether a stats request may be served.
*
* Loopback is always trusted. A private-range peer is trusted only when the
* `Host` authority it addressed is one of `lanHosts` — the operator-declared
* set of LAN authorities this panel answers on — which keeps an undeclared
* host (a DNS-rebinding target, or a second interface the operator did not
* mean to publish) rejected even though the peer's address looks local.
*
* On top of the peer/authority pair the browser's own same-origin markers are
* enforced for every caller: an explicit `sec-fetch-site: cross-site`, or an
* `Origin` whose host differs from the addressed authority, is refused. That is
* what stops a page on another origin from reading usage data through the
* visitor's browser.
*
* @param request - the inbound request.
* @param lanHosts - hostnames (no port) that may be addressed from the LAN; empty means loopback-only.
* @returns whether the request is allowed to read stats.
*/
function isStatsRequestAllowed(request, lanHosts = []) {
	const address = request.socket.remoteAddress;
	if (typeof address !== "string") return false;
	const host = request.headers.host;
	if (typeof host !== "string") return false;
	let hostUrl;
	try {
		hostUrl = new URL(`http://${host}`);
	} catch {
		return false;
	}
	const hostname = normalizeHostname(hostUrl.hostname);
	if (isLoopbackAddress(address)) {
		if (!LOOPBACK_HOSTNAMES.has(hostname)) return false;
	} else {
		if (!isPrivateAddress(address)) return false;
		if (!lanHosts.some((entry) => normalizeHostname(entry) === hostname)) return false;
	}
	if (request.headers["sec-fetch-site"] === "cross-site") return false;
	const origin = request.headers.origin;
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** One JSON response. */
function writeJson(res, status, body) {
	const payload = JSON.stringify(body);
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"referrer-policy": "no-referrer"
	});
	res.end(payload);
}
const SETTINGS_PATH = join(homedir(), ".dsh", "settings.yaml");
/**
* Read provider configurations from ~/.dsh/settings.yaml (llm-pi-ai.providers
* and llm-deepseek). Falls back to the well-known local channels when the
* file is unreadable. YAML parsed conservatively — no external dependency.
*/
function readProviderConfigs() {
	const configs = [];
	try {
		const providers = parseSimpleYaml(readFileSync(SETTINGS_PATH, "utf8"))["llm-pi-ai"]?.["providers"] ?? {};
		for (const [name, spec] of Object.entries(providers)) {
			const typed = spec ?? {};
			configs.push({
				provider: name,
				displayName: typeof typed["displayName"] === "string" ? typed["displayName"] : name,
				apiKeyEnv: typeof typed["apiKeyEnv"] === "string" ? typed["apiKeyEnv"] : "",
				baseURL: typeof typed["baseURL"] === "string" ? typed["baseURL"] : void 0
			});
		}
	} catch {}
	if (configs.length === 0) configs.push({
		provider: "opencode-go",
		displayName: "OpenCode Go 套餐",
		apiKeyEnv: "OPENCODE_GO_API_KEY"
	}, {
		provider: "mimo",
		displayName: "小米 MiMo Token Plan",
		apiKeyEnv: "XIAOMI_API_KEY",
		baseURL: "https://token-plan-cn.xiaomimimo.com/v1"
	});
	configs.push({
		provider: "deepseek-official",
		displayName: "DeepSeek 官方",
		apiKeyEnv: "DEEPSEEK_API_KEY",
		baseURL: "https://api.deepseek.com"
	});
	return configs;
}
/**
* The LAN authorities this panel may answer stats requests on, read from
* `stats-panel.lanHosts` in ~/.dsh/settings.yaml:
*
* ```yaml
* stats-panel:
*   lanHosts: [172.19.81.21, dsh.local]
* ```
*
* Absent or empty means loopback-only — the pre-existing behaviour — so simply
* upgrading never widens who can read usage data; the operator opts in by
* naming each authority.
* @returns the declared hostnames (no ports), or an empty list.
*/
function readLanHosts() {
	try {
		const declared = parseSimpleYaml(readFileSync(SETTINGS_PATH, "utf8"))["stats-panel"]?.["lanHosts"];
		if (typeof declared === "string") return declared.replace(/^\[|\]$/g, "").split(",").map((entry) => entry.trim().replace(/^['"]|['"]$/g, "")).filter((entry) => entry !== "");
		if (Array.isArray(declared)) return declared.filter((entry) => typeof entry === "string" && entry.trim() !== "").map((entry) => entry.trim());
	} catch {}
	return [];
}
/**
* The calendar used for day / week / month buckets, as minutes east of UTC.
*
* ```yaml
* stats-panel:
*   dayBoundary: local   # local (default) | utc | +08:00 | 480
* ```
*
* Default is the host's own timezone, so「今日消耗」rolls over at local
* midnight instead of 08:00 for a UTC+8 operator. Detail rows keep raw
* timestamps, so switching this back to `utc` re-buckets everything that is
* still in records.jsonl — nothing is rewritten or lost either way.
* @returns minutes east of UTC (UTC+8 → 480).
*/
function readBucketOffsetMinutes() {
	const local = -(/* @__PURE__ */ new Date()).getTimezoneOffset();
	let declared;
	try {
		declared = parseSimpleYaml(readFileSync(SETTINGS_PATH, "utf8"))["stats-panel"]?.["dayBoundary"];
	} catch {
		return local;
	}
	if (typeof declared !== "string") return local;
	const value = declared.trim().replace(/^['"]|['"]$/g, "").toLowerCase();
	if (value === "" || value === "local") return local;
	if (value === "utc") return 0;
	const hhmm = /^([+-])(\d{1,2}):?(\d{2})$/.exec(value);
	if (hhmm !== null) {
		const minutes = Number(hhmm[2]) * 60 + Number(hhmm[3]);
		return hhmm[1] === "-" ? -minutes : minutes;
	}
	const numeric = Number(value);
	return Number.isFinite(numeric) && Math.abs(numeric) <= 900 ? numeric : local;
}
/** Minimal YAML subset parser for settings.yaml provider maps (indent-aware, nested). */
function parseSimpleYaml(text) {
	const root = {};
	const stack = [{
		indent: -1,
		map: root
	}];
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("-")) continue;
		const indent = line.length - line.trimStart().length;
		const match = /^([A-Za-z0-9_.-]+):\s*(.*)$/.exec(trimmed);
		if (match === null) continue;
		const key = match[1];
		const value = match[2].trim();
		while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
		const parent = stack[stack.length - 1].map;
		if (value === "") {
			const child = {};
			parent[key] = child;
			stack.push({
				indent,
				map: child
			});
		} else parent[key] = value;
	}
	return root;
}
/** Read the MiMo platform login Cookie from env or the local cookie file. */
function readMimoCookie() {
	const fromEnv = process.env["MIMO_PLATFORM_COOKIE"];
	if (typeof fromEnv === "string" && fromEnv.trim() !== "") return fromEnv.trim();
	try {
		if (existsSync(MIMO_COOKIE_FILE)) {
			const content = readFileSync(MIMO_COOKIE_FILE, "utf8").trim();
			if (content !== "") return content;
		}
	} catch {}
}
/** Fetch with a bounded timeout; throws on non-OK or network failure. */
async function probeJson(url, headers, timeoutMs = 1e4) {
	const response = await fetch(url, {
		headers,
		signal: AbortSignal.timeout(timeoutMs)
	});
	if (!response.ok) throw new Error(`HTTP ${response.status}`);
	const body = await response.json();
	if (typeof body !== "object" || body === null) throw new Error("invalid JSON response");
	return body;
}
/** Fetch with retry; useful for flaky external usage/quota endpoints. */
async function probeJsonWithRetry(url, headers, options = {}) {
	const timeoutMs = options.timeoutMs ?? 1e4;
	const retries = options.retries ?? 0;
	let lastError;
	for (let attempt = 0; attempt <= retries; attempt++) try {
		return await probeJson(url, headers, timeoutMs);
	} catch (e) {
		lastError = e;
		if (e instanceof Error && /^HTTP 4\d\d$/.test(e.message) && !/^HTTP 429$/.test(e.message)) throw e;
		if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500));
	}
	throw lastError;
}
function numField(obj, field) {
	const value = obj[field];
	if (typeof value === "number") return value;
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : void 0;
	}
}
/** 金额文案（USD/CNY 通用）：≥1B → B，≥1M → M，其余千分位两位小数。 */
function amountText(amount) {
	const abs = Math.abs(amount);
	if (abs >= 1e9) return `${(amount / 1e9).toFixed(2)}B`;
	if (abs >= 1e6) return `${(amount / 1e6).toFixed(2)}M`;
	return amount.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}
/** 紧凑 token 文案（note 拼接用）：1.56B / 753M / 82.4K。 */
function tokensShort(tokens) {
	const abs = Math.abs(tokens);
	if (abs >= 1e9) return `${(tokens / 1e9).toFixed(2)}B`;
	if (abs >= 1e6) return `${(tokens / 1e6).toFixed(1)}M`;
	if (abs >= 1e3) return `${(tokens / 1e3).toFixed(1)}K`;
	return String(Math.round(tokens));
}
/** NewAPI 无限额度令牌在 subscription 端点上的哨兵值（hard_limit_usd = 1e8）。 */
const NEWAPI_UNLIMITED_SENTINEL = 1e8;
/** new-api 默认额度换算：$1 = 500000 quota（QuotaPerUnit）。 */
const NEWAPI_QUOTA_PER_UNIT = 5e5;
/** 由 apiKeyEnv 推导控制台访问令牌的凭据名：AGENTROUTER_API_KEY → AGENTROUTER_ACCESS_TOKEN。 */
function accessTokenEnvOf(apiKeyEnv) {
	return apiKeyEnv.endsWith("_API_KEY") ? apiKeyEnv.slice(0, -8) + "_ACCESS_TOKEN" : apiKeyEnv + "_ACCESS_TOKEN";
}
/**
* 控制台会话文件：`DATA_DIR/<provider>-cookie.txt`，内容为浏览器登录态的
* Cookie 头（如 `session=...`），可附 `new-api-user=<id>`（new-api 系控制台
* API 要求该头）。读取失败返回 undefined。
*/
function readConsoleSession(provider) {
	try {
		const file = join(DATA_DIR, `${provider}-cookie.txt`);
		if (!existsSync(file)) return void 0;
		const raw = readFileSync(file, "utf8").trim();
		if (raw === "") return void 0;
		return {
			cookie: raw,
			newApiUser: /(?:^|;\s*)new-api-user=(\d+)/.exec(raw)?.[1]
		};
	} catch {
		return;
	}
}
/**
* Whether a probe failure means "the network/upstream is broken" (as opposed
* to "this site just is not a NewAPI/Sub2API gateway"): HTTP status answers
* are protocol-level rejections, everything else (timeout, DNS, refused,
* aborted) means the attempt never got a real answer.
*/
function isNetworkProbeError(e) {
	return e instanceof Error && !/^HTTP \d+$/.test(e.message);
}
/**
* NewAPI / one-api 系中转站的 OpenAI 计费模拟端点（AgentRouter 等均支持）：
* `GET <base>/dashboard/billing/subscription` 返回 `hard_limit_usd`，
* `GET <base>/dashboard/billing/usage` 返回 `total_usage`（美分）。
* 语义：hard_limit = 剩余 + 已用（总额度），故余额 = hard_limit - used。
* 例外：key 为无限额度令牌时 hard_limit 恒为 1e8 哨兵值，余额在用户配额上，
* 只能走控制台接口 `/api/user/self`：优先 `<provider>-cookie.txt` 会话
* （经本地浏览器桥时 Cookie 由桥注入，另发 `New-Api-User` 头），其次访问
* 令牌凭据 `<XXX>_ACCESS_TOKEN`；都没有则回退手动填写并说明。
* `diag.note` collects the last network-level failure so the caller can show
* "查询失败" instead of mistaking it for an unconfigurable channel.
* @returns 余额/手动行；返回 undefined 表示该站不是 NewAPI 系。
*/
async function probeNewApiBilling(config, base, key, now, resolveKey, diag = {}) {
	let sub;
	try {
		sub = await probeJsonWithRetry(`${base}/dashboard/billing/subscription`, { authorization: `Bearer ${key}` }, {
			timeoutMs: 12e3,
			retries: 1
		});
	} catch (e) {
		if (isNetworkProbeError(e)) diag.note = `上游查询失败：${e instanceof Error ? e.message : String(e)}`;
		return;
	}
	const totalUsd = numField(sub, "hard_limit_usd") ?? numField(sub, "system_hard_limit_usd");
	if (totalUsd === void 0) return void 0;
	let usedUsd = 0;
	try {
		const fmt = (d) => d.toISOString().slice(0, 10);
		const end = /* @__PURE__ */ new Date();
		usedUsd = (numField(await probeJson(`${base}/dashboard/billing/usage?start_date=${fmt(/* @__PURE__ */ new Date(end.getTime() - 30 * 864e5))}&end_date=${fmt(end)}`, { authorization: `Bearer ${key}` }, 12e3), "total_usage") ?? 0) / 100;
	} catch {}
	if (totalUsd >= NEWAPI_UNLIMITED_SENTINEL) {
		const origin = new URL(base).origin;
		const hint = `余额在用户配额上（无限额度令牌，已用 $${amountText(usedUsd)}）：从已登录浏览器导出 Cookie 存入 DATA_DIR/${config.provider}-cookie.txt，或在控制台生成访问令牌存入 ${accessTokenEnvOf(config.apiKeyEnv)}`;
		const attempt = async (headers) => {
			const data = (await probeJsonWithRetry(`${origin}/api/user/self`, headers, {
				timeoutMs: 15e3,
				retries: 1
			}))["data"];
			return data !== void 0 ? numField(data, "quota") : void 0;
		};
		const session = readConsoleSession(config.provider);
		let consoleError;
		if (session !== void 0) {
			const headers = {
				cookie: session.cookie,
				accept: "application/json"
			};
			if (session.newApiUser !== void 0) headers["new-api-user"] = session.newApiUser;
			try {
				const quotaRaw = await attempt(headers);
				if (quotaRaw !== void 0) return {
					channel: config.provider,
					kind: "balance",
					displayName: config.displayName,
					balance: amountText(quotaRaw / NEWAPI_QUOTA_PER_UNIT),
					currency: "USD",
					note: `用户余额（控制台会话）· 已用 $${amountText(usedUsd)}`,
					fetchedAt: now
				};
			} catch (e) {
				consoleError = e;
			}
		}
		const accessToken = await resolveKey(accessTokenEnvOf(config.apiKeyEnv));
		if (accessToken !== void 0) try {
			const quotaRaw = await attempt({
				authorization: `Bearer ${accessToken}`,
				accept: "application/json"
			});
			if (quotaRaw !== void 0) return {
				channel: config.provider,
				kind: "balance",
				displayName: config.displayName,
				balance: amountText(quotaRaw / NEWAPI_QUOTA_PER_UNIT),
				currency: "USD",
				note: `用户余额（访问令牌）· 已用 $${amountText(usedUsd)}`,
				fetchedAt: now
			};
		} catch (e) {
			consoleError = e;
		}
		if (consoleError !== void 0 && isNetworkProbeError(consoleError)) return {
			channel: config.provider,
			kind: "manual",
			displayName: config.displayName,
			error: `上游查询失败：${consoleError instanceof Error ? consoleError.message : String(consoleError)}`
		};
		return {
			channel: config.provider,
			kind: "manual",
			displayName: config.displayName,
			note: session !== void 0 ? `控制台会话已失效，请重新导出 Cookie 更新 DATA_DIR/${config.provider}-cookie.txt（已用 $${amountText(usedUsd)}）` : hint
		};
	}
	return {
		channel: config.provider,
		kind: "balance",
		displayName: config.displayName,
		balance: amountText(totalUsd - usedUsd),
		currency: "USD",
		note: `NewAPI 额度 $${amountText(totalUsd)} · 已用 $${amountText(usedUsd)}`,
		fetchedAt: now
	};
}
/** Sub2API 系网关（mdkj.lol 等）：`GET <base>/usage` 用 sk key 自查余额与用量。 */
async function probeSub2ApiUsage(config, base, key, now, diag = {}) {
	let body;
	try {
		body = await probeJsonWithRetry(`${base}/usage`, { authorization: `Bearer ${key}` }, {
			timeoutMs: 2e4,
			retries: 1
		});
	} catch (e) {
		if (isNetworkProbeError(e)) diag.note = `上游查询失败：${e instanceof Error ? e.message : String(e)}`;
		return;
	}
	const remaining = numField(body, "remaining") ?? numField(body, "balance");
	if (remaining === void 0) return void 0;
	const unitRaw = typeof body["unit"] === "string" ? body["unit"] : "USD";
	const noteParts = [];
	if (typeof body["planName"] === "string" && body["planName"] !== "") noteParts.push(body["planName"]);
	const usage = body["usage"];
	const today = usage?.["today"];
	const total = usage?.["total"];
	if (today !== void 0) {
		const tok = numField(today, "total_tokens");
		const reqs = numField(today, "requests");
		if (tok !== void 0) noteParts.push(`今日 ${tokensShort(tok)} tok / ${reqs ?? 0} 次`);
	}
	if (total !== void 0) {
		const cost = numField(total, "actual_cost") ?? numField(total, "cost");
		if (cost !== void 0) noteParts.push(`累计成本 $${amountText(cost)}`);
	}
	return {
		channel: config.provider,
		kind: "balance",
		displayName: config.displayName,
		balance: amountText(remaining),
		currency: unitRaw === "CNY" ? "CNY" : "USD",
		note: noteParts.length > 0 ? noteParts.join(" · ") : void 0,
		fetchedAt: now
	};
}
/**
* One channel's account probe. Returns the ChannelBalance or throws.
* Adapts the well-known provider endpoints (community-verified by cc-switch
* plus OpenCode Go / OpenAI / Anthropic usage APIs).
*/
async function probeChannel(ctx, config, resolveKey) {
	const base = config.baseURL ?? "";
	const url = base.toLowerCase();
	const now = Date.now();
	if (url.includes("opencode.ai/zen/go") || config.provider === "opencode-go") {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "plan",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const usage = (await probeJson("https://opencode.ai/zen/go/v1/usage", { authorization: `Bearer ${key}` }))["usage"];
		const quota = [];
		const push = (label, bucket) => {
			const typed = bucket;
			if (typed === void 0) return;
			quota.push({
				label,
				percent: numField(typed, "percent") ?? 0,
				resetsAt: typeof typed["resetsAt"] === "string" ? typed["resetsAt"] : ""
			});
		};
		push("滚动", usage?.["rolling"]);
		push("7天", usage?.["weekly"]);
		push("30天", usage?.["monthly"]);
		return {
			channel: config.provider,
			kind: "plan",
			displayName: config.displayName,
			quota,
			fetchedAt: now
		};
	}
	if (config.provider === "mimo" || url.includes("token-plan-cn.xiaomimimo.com")) {
		const cookie = readMimoCookie();
		if (cookie === void 0) return {
			channel: config.provider,
			kind: "manual",
			displayName: config.displayName
		};
		let body;
		try {
			body = await probeJsonWithRetry("https://platform.xiaomimimo.com/api/v1/tokenPlan/usage", {
				cookie,
				accept: "application/json, text/plain, */*",
				origin: "https://platform.xiaomimimo.com",
				referer: "https://platform.xiaomimimo.com/console/plan-manage",
				"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
			}, {
				timeoutMs: 2e4,
				retries: 1
			});
		} catch (e) {
			if (e instanceof Error && /^HTTP 401$/.test(e.message)) return {
				channel: config.provider,
				kind: "plan",
				displayName: config.displayName,
				error: "MiMo 登录已过期，请重新登录 platform.xiaomimimo.com 并更新 Cookie（~/.dsh/stats-panel/mimo-cookie.txt）",
				fetchedAt: now
			};
			throw e;
		}
		const items = (body["data"]?.["usage"])?.["items"];
		const quota = [];
		const labelOf = (name) => name === "plan_total_token" ? "总套餐" : name === "month_total_token" ? "本月" : name;
		const primary = (Array.isArray(items) ? items : []).find((item) => {
			if (typeof item !== "object" || item === null) return false;
			const name = typeof item["name"] === "string" ? String(item["name"]) : "";
			const limit = numField(item, "limit");
			return name === "plan_total_token" || limit !== void 0 && limit > 0;
		});
		if (primary !== void 0 && typeof primary === "object" && primary !== null) quota.push({
			label: labelOf(typeof primary["name"] === "string" ? String(primary["name"]) : "总套餐"),
			percent: (numField(primary, "percent") ?? 0) * 100,
			resetsAt: "",
			used: numField(primary, "used"),
			limit: numField(primary, "limit")
		});
		if (quota.length === 0) throw new Error("MiMo 平台未返回套餐用量");
		return {
			channel: config.provider,
			kind: "plan",
			displayName: config.displayName,
			quota,
			fetchedAt: now
		};
	}
	if (url.includes("api.deepseek.com")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const info = (await probeJson("https://api.deepseek.com/user/balance", { authorization: `Bearer ${key}` }))["balance_infos"]?.[0];
		return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			balance: info !== void 0 ? String(numField(info, "total_balance") ?? "0") : "0",
			currency: typeof info?.["currency"] === "string" ? info["currency"] : "CNY",
			fetchedAt: now
		};
	}
	if (url.includes("api.moonshot.cn") || url.includes("api.kimi.ai")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const data = (await probeJson(`${url.includes("api.kimi.ai") ? "https://api.kimi.ai" : "https://api.moonshot.cn"}/v1/users/me/balance`, { authorization: `Bearer ${key}` }))["data"];
		const available = numField(data ?? {}, "available_balance");
		return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			balance: available !== void 0 ? String(available) : void 0,
			currency: typeof data?.["currency"] === "string" ? data["currency"] : "CNY",
			fetchedAt: now
		};
	}
	if (url.includes("api.siliconflow.cn") || url.includes("api.siliconflow.com")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const isCn = url.includes(".cn");
		const data = (await probeJson(`${isCn ? "https://api.siliconflow.cn" : "https://api.siliconflow.com"}/v1/user/info`, { authorization: `Bearer ${key}` }))["data"];
		const total = numField(data ?? {}, "totalBalance");
		return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			balance: total !== void 0 ? String(total) : void 0,
			currency: isCn ? "CNY" : "USD",
			fetchedAt: now
		};
	}
	if (url.includes("api.stepfun.com") || url.includes("api.stepfun.ai")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const balance = numField(await probeJson("https://api.stepfun.com/v1/accounts", { authorization: `Bearer ${key}` }), "balance");
		return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			balance: balance !== void 0 ? String(balance) : void 0,
			currency: "CNY",
			fetchedAt: now
		};
	}
	if (url.includes("openrouter.ai")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const data = (await probeJson("https://openrouter.ai/api/v1/credits", { authorization: `Bearer ${key}` }))["data"];
		const total = numField(data ?? {}, "total_credits") ?? 0;
		const used = numField(data ?? {}, "total_usage") ?? 0;
		return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			balance: String(Math.max(0, total - used)),
			currency: "USD",
			fetchedAt: now
		};
	}
	if (url.includes("api.novita.ai")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const available = (numField(await probeJson("https://api.novita.ai/v3/user/balance", { authorization: `Bearer ${key}` }), "availableBalance") ?? 0) / 1e4;
		return {
			channel: config.provider,
			kind: "balance",
			displayName: config.displayName,
			balance: String(available),
			currency: "USD",
			fetchedAt: now
		};
	}
	if (url.includes("api.openai.com")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "plan",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const day = 864e5;
		const buckets = [
			{
				label: "5小时",
				windowMs: 5 * 36e5
			},
			{
				label: "7天",
				windowMs: 7 * day
			},
			{
				label: "30天",
				windowMs: 30 * day
			}
		];
		const usage = await Promise.all(buckets.map(async (bucket) => {
			const rows = (await probeJson(`https://api.openai.com/v1/usage?start_time=${Math.floor((now - bucket.windowMs) / 1e3)}&bucket_width=1d`, { authorization: `Bearer ${key}` }))["data"] ?? [];
			let input = 0;
			let output = 0;
			for (const row of rows) {
				input += numField(row, "input_tokens") ?? 0;
				output += numField(row, "output_tokens") ?? 0;
			}
			return {
				label: bucket.label,
				inputTokens: input,
				outputTokens: output
			};
		}));
		return {
			channel: config.provider,
			kind: "plan",
			displayName: config.displayName,
			usage,
			fetchedAt: now
		};
	}
	if (url.includes("api.anthropic.com")) {
		const key = await resolveKey(config.apiKeyEnv);
		if (key === void 0) return {
			channel: config.provider,
			kind: "plan",
			displayName: config.displayName,
			error: `未找到 ${config.apiKeyEnv} 凭据`
		};
		const day = 864e5;
		const buckets = [
			{
				label: "5小时",
				windowMs: 5 * 36e5
			},
			{
				label: "7天",
				windowMs: 7 * day
			},
			{
				label: "30天",
				windowMs: 30 * day
			}
		];
		const usage = await Promise.all(buckets.map(async (bucket) => {
			const rows = (await probeJson(`https://api.anthropic.com/v1/organizations/usage/costs?start_time=${new Date(now - bucket.windowMs).toISOString()}&bucket_width=1h`, {
				"x-api-key": key,
				"anthropic-version": "2023-06-01"
			}))["data"] ?? [];
			let input = 0;
			let output = 0;
			for (const row of rows) {
				const usagePart = row["usage"];
				input += numField(usagePart ?? {}, "input_tokens") ?? 0;
				output += numField(usagePart ?? {}, "output_tokens") ?? 0;
			}
			return {
				label: bucket.label,
				inputTokens: input,
				outputTokens: output
			};
		}));
		return {
			channel: config.provider,
			kind: "plan",
			displayName: config.displayName,
			usage,
			fetchedAt: now
		};
	}
	if (base !== "") {
		const key = await resolveKey(config.apiKeyEnv);
		if (key !== void 0) {
			const diag = {};
			const newApi = await probeNewApiBilling(config, base, key, now, resolveKey, diag);
			if (newApi !== void 0) return newApi;
			const sub2api = await probeSub2ApiUsage(config, base, key, now, diag);
			if (sub2api !== void 0) return sub2api;
			if (diag.note !== void 0) return {
				channel: config.provider,
				kind: "manual",
				displayName: config.displayName,
				error: diag.note
			};
		}
	}
	return {
		channel: config.provider,
		kind: "manual",
		displayName: config.displayName
	};
}
/** Runtime validation for persisted numeric fields. Token counts are integral and non-negative. */
function isNonNegativeSafeInteger(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
const MAX_DATE_MS = 864e13;
function isValidTimestamp(value) {
	return isNonNegativeSafeInteger(value) && value <= MAX_DATE_MS;
}
function objectOf(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
}
function labelOrUnknown(value) {
	if (typeof value !== "string") return "unknown";
	const label = value.trim();
	return label === "" ? "unknown" : label;
}
/** Optional fields from older records default to zero; present invalid fields fail closed. */
function countField(object, field, optional = false) {
	if (object[field] === void 0 && optional) return 0;
	return isNonNegativeSafeInteger(object[field]) ? object[field] : null;
}
function tokenTotal(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) {
	return inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens;
}
function tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) {
	const total = tokenTotal(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
	return isNonNegativeSafeInteger(total) ? total : null;
}
const AGGREGATE_COUNTER_KEYS = [
	"calls",
	"inputTokens",
	"outputTokens",
	"cacheReadTokens",
	"cacheWriteTokens",
	"reasoningTokens"
];
function sumAggregateRows(rows) {
	const sum = {
		calls: 0,
		inputTokens: 0,
		outputTokens: 0,
		cacheReadTokens: 0,
		cacheWriteTokens: 0,
		reasoningTokens: 0
	};
	for (const row of rows) for (const key of AGGREGATE_COUNTER_KEYS) {
		const next = sum[key] + row[key];
		if (!isNonNegativeSafeInteger(next)) return null;
		sum[key] = next;
	}
	return sum;
}
function sameAggregateCounters(left, right) {
	return AGGREGATE_COUNTER_KEYS.every((key) => left[key] === right[key]);
}
function normalizeUsageCounters(value) {
	const object = objectOf(value);
	if (object === null) return null;
	const inputTokens = countField(object, "inputTokens");
	const outputTokens = countField(object, "outputTokens");
	const cacheReadTokens = countField(object, "cacheReadTokens", true);
	const cacheWriteTokens = countField(object, "cacheWriteTokens", true);
	const reasoningTokens = countField(object, "reasoningTokens", true);
	if (inputTokens === null || outputTokens === null || cacheReadTokens === null || cacheWriteTokens === null || reasoningTokens === null) return null;
	if (tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens) === null) return null;
	return {
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		reasoningTokens
	};
}
/** Normalize one record while preserving old rows that omitted optional counters. */
function normalizeUsageRecord(value) {
	const object = objectOf(value);
	if (object === null || !isValidTimestamp(object.ts) || !isNonNegativeSafeInteger(object.seq) || typeof object.sessionId !== "string" || object.sessionId.trim() === "" || typeof object.model !== "string" || typeof object.provider !== "string") return null;
	const counters = normalizeUsageCounters(object);
	if (counters === null) return null;
	return {
		ts: object.ts,
		seq: object.seq,
		sessionId: object.sessionId,
		model: labelOrUnknown(object.model),
		provider: labelOrUnknown(object.provider),
		...counters
	};
}
function normalizeModelStats(value) {
	const object = objectOf(value);
	if (object === null || typeof object.model !== "string") return null;
	const calls = countField(object, "calls");
	const inputTokens = countField(object, "inputTokens");
	const outputTokens = countField(object, "outputTokens");
	const cacheReadTokens = countField(object, "cacheReadTokens", true);
	const cacheWriteTokens = countField(object, "cacheWriteTokens", true);
	const reasoningTokens = countField(object, "reasoningTokens", true);
	if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null || cacheWriteTokens === null || reasoningTokens === null) return null;
	const totalTokens = tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
	if (totalTokens === null) return null;
	return {
		model: labelOrUnknown(object.model),
		calls,
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		reasoningTokens,
		totalTokens
	};
}
function normalizeChannelStats(value) {
	const object = objectOf(value);
	if (object === null || typeof object.channel !== "string" || !Array.isArray(object.models) || !object.models.every((model) => typeof model === "string")) return null;
	const calls = countField(object, "calls");
	const inputTokens = countField(object, "inputTokens");
	const outputTokens = countField(object, "outputTokens");
	const cacheReadTokens = countField(object, "cacheReadTokens", true);
	const cacheWriteTokens = countField(object, "cacheWriteTokens", true);
	const reasoningTokens = countField(object, "reasoningTokens", true);
	if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null || cacheWriteTokens === null || reasoningTokens === null) return null;
	const totalTokens = tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
	if (totalTokens === null) return null;
	return {
		channel: labelOrUnknown(object.channel),
		models: object.models.map((model) => labelOrUnknown(model)),
		calls,
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		reasoningTokens,
		totalTokens
	};
}
function normalizeBucket(value) {
	const object = objectOf(value);
	if (object === null) return null;
	const rawDate = typeof object.date === "string" ? object.date : object.period;
	if (typeof rawDate !== "string" || rawDate.trim() === "") return null;
	const date = rawDate.trim();
	const rawPeriod = object.period === void 0 ? date : object.period;
	if (typeof rawPeriod !== "string" || rawPeriod.trim() === "") return null;
	const period = rawPeriod.trim();
	if (period !== date) return null;
	const calls = countField(object, "calls");
	const inputTokens = countField(object, "inputTokens");
	const outputTokens = countField(object, "outputTokens");
	const cacheReadTokens = countField(object, "cacheReadTokens", true);
	const cacheWriteTokens = countField(object, "cacheWriteTokens", true);
	const reasoningTokens = countField(object, "reasoningTokens", true);
	if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null || cacheWriteTokens === null || reasoningTokens === null) return null;
	const totalTokens = tokenTotalOrNull(inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens);
	if (totalTokens === null) return null;
	return {
		date,
		period,
		calls,
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		reasoningTokens,
		totalTokens
	};
}
function normalizeAggregate(value) {
	const object = objectOf(value);
	const totalsObject = object === null ? null : objectOf(object.totals);
	if (object === null || totalsObject === null || !Array.isArray(object.modelStats) || !Array.isArray(object.channelStats) || !Array.isArray(object.dailyStats)) return null;
	const calls = countField(totalsObject, "calls");
	const inputTokens = countField(totalsObject, "inputTokens");
	const outputTokens = countField(totalsObject, "outputTokens");
	const cacheReadTokens = countField(totalsObject, "cacheReadTokens", true);
	const cacheWriteTokens = countField(totalsObject, "cacheWriteTokens", true);
	const reasoningTokens = countField(totalsObject, "reasoningTokens", true);
	const modelStats = object.modelStats.map(normalizeModelStats);
	const channelStats = object.channelStats.map(normalizeChannelStats);
	const dailyStats = object.dailyStats.map(normalizeBucket);
	const hasWeeklyStats = object.weeklyStats !== void 0;
	const hasMonthlyStats = object.monthlyStats !== void 0;
	const weeklyStats = hasWeeklyStats ? object.weeklyStats : [];
	const monthlyStats = hasMonthlyStats ? object.monthlyStats : [];
	if (calls === null || inputTokens === null || outputTokens === null || cacheReadTokens === null || cacheWriteTokens === null || reasoningTokens === null || modelStats.some((value) => value === null) || channelStats.some((value) => value === null) || dailyStats.some((value) => value === null) || !Array.isArray(weeklyStats) || !Array.isArray(monthlyStats)) return null;
	const normalizedWeekly = weeklyStats.map(normalizeBucket);
	const normalizedMonthly = monthlyStats.map(normalizeBucket);
	if (normalizedWeekly.some((value) => value === null) || normalizedMonthly.some((value) => value === null)) return null;
	const normalizedModel = modelStats;
	const normalizedChannel = channelStats;
	const normalizedDaily = dailyStats;
	const normalizedWeeklyStats = normalizedWeekly;
	const normalizedMonthlyStats = normalizedMonthly;
	const totals = {
		calls,
		inputTokens,
		outputTokens,
		cacheReadTokens,
		cacheWriteTokens,
		reasoningTokens
	};
	const dimensions = [
		normalizedModel,
		normalizedChannel,
		normalizedDaily
	];
	if (hasWeeklyStats) dimensions.push(normalizedWeeklyStats);
	if (hasMonthlyStats) dimensions.push(normalizedMonthlyStats);
	if (dimensions.some((rows) => {
		const sum = sumAggregateRows(rows);
		return sum === null || !sameAggregateCounters(sum, totals);
	})) return null;
	return {
		totals: {
			calls,
			inputTokens,
			outputTokens,
			cacheReadTokens,
			cacheWriteTokens,
			reasoningTokens
		},
		modelStats,
		channelStats,
		dailyStats,
		weeklyStats: normalizedWeekly,
		monthlyStats: normalizedMonthly
	};
}
/** Load and normalize the durable usage log; malformed rows are ignored. */
function loadRecords(cutoffTs) {
	try {
		if (!existsSync(RECORDS_FILE)) return [];
		const lines = readFileSync(RECORDS_FILE, "utf8").split("\n").filter((line) => line.trim() !== "");
		const records = [];
		const loadedKeys = /* @__PURE__ */ new Set();
		for (const line of lines) try {
			const record = normalizeUsageRecord(JSON.parse(line));
			if (record !== null && (cutoffTs === void 0 || record.ts >= cutoffTs)) {
				const key = `${record.sessionId}:${record.seq}`;
				if (loadedKeys.has(key)) continue;
				loadedKeys.add(key);
				records.push(record);
			}
		} catch {}
		return records;
	} catch {
		return [];
	}
}
/** Persist one record (best effort; a failed write must never take the GUI down). */
function appendRecord(record) {
	try {
		appendFileSync(RECORDS_FILE, JSON.stringify(record) + "\n");
	} catch {}
}
/** Write via a process-unique tmp+rename so crashes cannot truncate the target. */
let atomicWriteId = 0;
function writeFileAtomic(path, data) {
	const tmp = `${path}.${process.pid}.${++atomicWriteId}.tmp`;
	writeFileSync(tmp, data);
	renameSync(tmp, path);
}
function loadArchive() {
	try {
		if (!existsSync(ARCHIVE_FILE)) return null;
		const parsed = JSON.parse(readFileSync(ARCHIVE_FILE, "utf8"));
		if (parsed?.["version"] !== 1 || !isValidTimestamp(parsed["cutoffTs"])) return null;
		const aggregate = normalizeAggregate(parsed["aggregate"]);
		if (aggregate === null) return null;
		const offset = parsed["bucketOffsetMinutes"];
		return {
			version: 1,
			cutoffTs: parsed["cutoffTs"],
			aggregate,
			bucketOffsetMinutes: typeof offset === "number" && Number.isFinite(offset) ? offset : 0
		};
	} catch {
		return null;
	}
}
function loadBackfillState() {
	try {
		if (existsSync(BACKFILL_STATE_FILE)) {
			const parsed = JSON.parse(readFileSync(BACKFILL_STATE_FILE, "utf8"));
			const revisions = parsed["revisions"];
			if (parsed?.["version"] === 2 && objectOf(revisions) !== null && Object.values(revisions).every((value) => typeof value === "string") && isNonNegativeSafeInteger(parsed["recordsAtWrite"])) return {
				version: 2,
				revisions,
				recordsAtWrite: parsed["recordsAtWrite"]
			};
		}
	} catch {}
	return null;
}
/**
* Shift an instant into the bucket calendar so the UTC-based key helpers below
* read out local calendar fields. Detail rows keep their raw `ts`, so the
* bucket calendar is a pure presentation choice and stays reversible.
* @param ts - epoch milliseconds.
* @param offsetMinutes - minutes east of UTC (UTC+8 → 480).
*/
function shiftToBucketCalendar(ts, offsetMinutes) {
	return new Date(ts + offsetMinutes * 6e4);
}
/** `YYYY-MM-DD` — the daily key in the bucket calendar. */
function dayKey(ts, offsetMinutes) {
	return shiftToBucketCalendar(ts, offsetMinutes).toISOString().slice(0, 10);
}
/** `YYYY-MM` — calendar month in the bucket calendar. */
function monthKey(ts, offsetMinutes) {
	return shiftToBucketCalendar(ts, offsetMinutes).toISOString().slice(0, 7);
}
/**
* `YYYY-Www` — ISO-8601 week (Monday-based; week 01 holds the year's first
* Thursday). Computed on a UTC copy so the Thursday shift cannot roll across a
* DST boundary, and keyed by the ISO week-numbering year, which is why a date
* like 2027-01-01 correctly reports `2026-W53`.
*/
function isoWeekKey(ts, offsetMinutes) {
	const date = shiftToBucketCalendar(ts, offsetMinutes);
	const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	shifted.setUTCDate(shifted.getUTCDate() - (shifted.getUTCDay() + 6) % 7 + 3);
	const firstThursday = new Date(Date.UTC(shifted.getUTCFullYear(), 0, 4));
	firstThursday.setUTCDate(firstThursday.getUTCDate() - (firstThursday.getUTCDay() + 6) % 7 + 3);
	const week = 1 + Math.round((shifted.getTime() - firstThursday.getTime()) / (7 * 864e5));
	return `${shifted.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
/**
* Fold one record into a period bucket, creating it on first sight. Shared by
* the day/week/month maps so the three periods can never drift in which token
* classes they count.
*/
function accumulateBucket(map, period, record, recordTotal) {
	const bucket = map.get(period);
	if (bucket !== void 0) {
		bucket.calls++;
		bucket.inputTokens += record.inputTokens;
		bucket.outputTokens += record.outputTokens;
		bucket.cacheReadTokens += record.cacheReadTokens;
		bucket.cacheWriteTokens += record.cacheWriteTokens;
		bucket.reasoningTokens += record.reasoningTokens;
		bucket.totalTokens += recordTotal;
		return;
	}
	map.set(period, {
		date: period,
		period,
		calls: 1,
		inputTokens: record.inputTokens,
		outputTokens: record.outputTokens,
		cacheReadTokens: record.cacheReadTokens,
		cacheWriteTokens: record.cacheWriteTokens,
		reasoningTokens: record.reasoningTokens,
		totalTokens: recordTotal
	});
}
function newFold() {
	return {
		totals: {
			calls: 0,
			inputTokens: 0,
			outputTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			reasoningTokens: 0
		},
		modelMap: /* @__PURE__ */ new Map(),
		channelMap: /* @__PURE__ */ new Map(),
		dailyMap: /* @__PURE__ */ new Map(),
		weeklyMap: /* @__PURE__ */ new Map(),
		monthlyMap: /* @__PURE__ */ new Map()
	};
}
/**
* Fold one record into the accumulators.
* @param offsetMinutes - bucket calendar offset, minutes east of UTC.
*/
function foldRecord(fold, record, offsetMinutes) {
	const totals = fold.totals;
	totals.calls++;
	totals.inputTokens += record.inputTokens;
	totals.outputTokens += record.outputTokens;
	totals.cacheReadTokens += record.cacheReadTokens;
	totals.cacheWriteTokens += record.cacheWriteTokens;
	totals.reasoningTokens += record.reasoningTokens;
	const recordTotal = record.inputTokens + record.outputTokens + record.cacheReadTokens + record.cacheWriteTokens;
	const existing = fold.modelMap.get(record.model);
	if (existing !== void 0) {
		existing.calls++;
		existing.inputTokens += record.inputTokens;
		existing.outputTokens += record.outputTokens;
		existing.cacheReadTokens += record.cacheReadTokens;
		existing.cacheWriteTokens += record.cacheWriteTokens;
		existing.reasoningTokens += record.reasoningTokens;
		existing.totalTokens += recordTotal;
	} else fold.modelMap.set(record.model, {
		model: record.model,
		calls: 1,
		inputTokens: record.inputTokens,
		outputTokens: record.outputTokens,
		cacheReadTokens: record.cacheReadTokens,
		cacheWriteTokens: record.cacheWriteTokens,
		reasoningTokens: record.reasoningTokens,
		totalTokens: recordTotal
	});
	const channel = record.provider === "" ? "unknown" : record.provider;
	const channelEntry = fold.channelMap.get(channel);
	if (channelEntry !== void 0) {
		channelEntry.calls++;
		channelEntry.inputTokens += record.inputTokens;
		channelEntry.outputTokens += record.outputTokens;
		channelEntry.cacheReadTokens += record.cacheReadTokens;
		channelEntry.cacheWriteTokens += record.cacheWriteTokens;
		channelEntry.reasoningTokens += record.reasoningTokens;
		channelEntry.totalTokens += recordTotal;
		if (!channelEntry.models.includes(record.model)) channelEntry.models.push(record.model);
	} else fold.channelMap.set(channel, {
		channel,
		models: [record.model],
		calls: 1,
		inputTokens: record.inputTokens,
		outputTokens: record.outputTokens,
		cacheReadTokens: record.cacheReadTokens,
		cacheWriteTokens: record.cacheWriteTokens,
		reasoningTokens: record.reasoningTokens,
		totalTokens: recordTotal
	});
	accumulateBucket(fold.dailyMap, dayKey(record.ts, offsetMinutes), record, recordTotal);
	accumulateBucket(fold.weeklyMap, isoWeekKey(record.ts, offsetMinutes), record, recordTotal);
	accumulateBucket(fold.monthlyMap, monthKey(record.ts, offsetMinutes), record, recordTotal);
}
/** Fold an already-aggregated range (archive) into the accumulators. */
function foldAggregate(fold, aggregate) {
	const totals = fold.totals;
	totals.calls += aggregate.totals.calls;
	totals.inputTokens += aggregate.totals.inputTokens;
	totals.outputTokens += aggregate.totals.outputTokens;
	totals.cacheReadTokens += aggregate.totals.cacheReadTokens;
	totals.cacheWriteTokens += aggregate.totals.cacheWriteTokens;
	totals.reasoningTokens += aggregate.totals.reasoningTokens;
	for (const model of aggregate.modelStats) {
		const existing = fold.modelMap.get(model.model);
		if (existing === void 0) {
			fold.modelMap.set(model.model, { ...model });
			continue;
		}
		existing.calls += model.calls;
		existing.inputTokens += model.inputTokens;
		existing.outputTokens += model.outputTokens;
		existing.cacheReadTokens += model.cacheReadTokens;
		existing.cacheWriteTokens += model.cacheWriteTokens;
		existing.reasoningTokens += model.reasoningTokens;
		existing.totalTokens += model.totalTokens;
	}
	for (const channel of aggregate.channelStats) {
		const existing = fold.channelMap.get(channel.channel);
		if (existing === void 0) {
			fold.channelMap.set(channel.channel, {
				...channel,
				models: [...channel.models]
			});
			continue;
		}
		existing.calls += channel.calls;
		existing.inputTokens += channel.inputTokens;
		existing.outputTokens += channel.outputTokens;
		existing.cacheReadTokens += channel.cacheReadTokens;
		existing.cacheWriteTokens += channel.cacheWriteTokens;
		existing.reasoningTokens += channel.reasoningTokens;
		existing.totalTokens += channel.totalTokens;
		for (const model of channel.models) if (!existing.models.includes(model)) existing.models.push(model);
	}
	for (const key of [
		"dailyStats",
		"weeklyStats",
		"monthlyStats"
	]) {
		const target = key === "dailyStats" ? fold.dailyMap : key === "weeklyStats" ? fold.weeklyMap : fold.monthlyMap;
		for (const bucket of aggregate[key]) {
			const existing = target.get(bucket.period);
			if (existing === void 0) {
				target.set(bucket.period, { ...bucket });
				continue;
			}
			existing.calls += bucket.calls;
			existing.inputTokens += bucket.inputTokens;
			existing.outputTokens += bucket.outputTokens;
			existing.cacheReadTokens += bucket.cacheReadTokens;
			existing.cacheWriteTokens += bucket.cacheWriteTokens;
			existing.reasoningTokens += bucket.reasoningTokens;
			existing.totalTokens += bucket.totalTokens;
		}
	}
}
/** Aggregates over a record range (the compaction payload). */
function aggregateOf(records, offsetMinutes = 0) {
	const fold = newFold();
	for (const record of records) foldRecord(fold, record, offsetMinutes);
	return foldToAggregate(fold);
}
function foldToAggregate(fold) {
	return {
		totals: { ...fold.totals },
		modelStats: Array.from(fold.modelMap.values()),
		channelStats: Array.from(fold.channelMap.values()),
		dailyStats: Array.from(fold.dailyMap.values()),
		weeklyStats: Array.from(fold.weeklyMap.values()),
		monthlyStats: Array.from(fold.monthlyMap.values())
	};
}
/** Merge two aggregates (e.g. an existing archive with a newly archived range). */
function mergeAggregates(a, b) {
	const fold = newFold();
	foldAggregate(fold, a);
	foldAggregate(fold, b);
	return foldToAggregate(fold);
}
/**
* Fold the stable, eligible prefix of the detail log into an archive aggregate.
* Rows at or after `cutoffTs` remain in the detail file, so future timestamps
* and records arriving after the snapshot are not silently discarded.
* @returns the archive payload and retained detail rows, or `null` when no row is eligible.
*/
function compactRecords(records, now, offsetMinutes = 0) {
	if (records.length === 0 || !isValidTimestamp(now)) return null;
	const compactable = records.filter((record) => record.ts < now);
	if (compactable.length === 0) return null;
	return {
		cutoffTs: now,
		aggregate: aggregateOf(compactable, offsetMinutes),
		retained: records.filter((record) => record.ts >= now)
	};
}
/**
* Compute the summary aggregates: fold the detail records, optionally on top
* of the compacted archive aggregate, so totals stay exact across compaction.
*
* @param options.offsetMinutes - bucket calendar offset (minutes east of UTC).
*   Defaults to 0 (UTC) so the exported pure function keeps its original
*   behaviour for callers and tests; `apply()` passes the configured value.
* @param options.now - clock used for `dayKeyNow`; defaults to Date.now().
* @param options.archiveOffsetMinutes - the offset the archive was folded with,
*   surfaced as `bucketNotice` when it differs from the live one.
*/
function computeSummary(records, archive, options = {}) {
	const offsetMinutes = options.offsetMinutes ?? 0;
	const fold = newFold();
	for (const record of records) foldRecord(fold, record, offsetMinutes);
	if (archive !== void 0) foldAggregate(fold, archive);
	const totalTokens = fold.totals.inputTokens + fold.totals.outputTokens + fold.totals.cacheReadTokens + fold.totals.cacheWriteTokens;
	const promptTokens = fold.totals.inputTokens + fold.totals.cacheReadTokens + fold.totals.cacheWriteTokens;
	const cacheHitRate = promptTokens > 0 ? fold.totals.cacheReadTokens / promptTokens * 100 : 0;
	return {
		totalCalls: fold.totals.calls,
		totalInputTokens: fold.totals.inputTokens,
		totalOutputTokens: fold.totals.outputTokens,
		totalCacheReadTokens: fold.totals.cacheReadTokens,
		totalCacheWriteTokens: fold.totals.cacheWriteTokens,
		totalReasoningTokens: fold.totals.reasoningTokens,
		totalTokens,
		cacheHitRate,
		modelStats: Array.from(fold.modelMap.values()),
		channelStats: Array.from(fold.channelMap.values()).sort((a, b) => b.totalTokens - a.totalTokens),
		dailyStats: Array.from(fold.dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
		weeklyStats: Array.from(fold.weeklyMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
		monthlyStats: Array.from(fold.monthlyMap.values()).sort((a, b) => a.period.localeCompare(b.period)),
		recentRecords: [...records].sort((a, b) => b.ts - a.ts || b.seq - a.seq).slice(0, 100),
		bucketOffsetMinutes: offsetMinutes,
		dayKeyNow: dayKey(options.now ?? Date.now(), offsetMinutes),
		...archive !== void 0 && options.archiveOffsetMinutes !== void 0 && options.archiveOffsetMinutes !== offsetMinutes ? { bucketNotice: `历史归档按 UTC${formatOffset(options.archiveOffsetMinutes)} 分桶，当前按 UTC${formatOffset(offsetMinutes)}；总量不受影响，仅归档段的日期边界为近似值` } : {}
	};
}
/** `+08:00` / `-05:30` / `+00:00` — offset text for operator-facing notices. */
function formatOffset(offsetMinutes) {
	const sign = offsetMinutes < 0 ? "-" : "+";
	const abs = Math.abs(offsetMinutes);
	return `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
}
/**
* Mount the collector and routes.
* @param ctx - host plugin context carrying webServer.
*/
function apply(ctx) {
	mkdirSync(DATA_DIR, { recursive: true });
	/** Per-application summary cache; never share data between remounted hosts. */
	const summaryCache = {
		value: void 0,
		dirty: true
	};
	/** Per-application balance cache and probe deduplication. */
	const balancesCache = {
		value: void 0,
		get() {
			return this.value;
		},
		set(balances) {
			this.value = {
				at: Date.now(),
				balances
			};
		}
	};
	let balancesInFlight;
	const bootArchive = loadArchive();
	let archive = bootArchive;
	let records = loadRecords(bootArchive?.cutoffTs);
	/** Calendar for day/week/month buckets; read once, like lanHosts. */
	const bucketOffsetMinutes = readBucketOffsetMinutes();
	/** Compaction trigger, overridable for tests and constrained hosts. */
	const configuredMax = Number(process.env["DSH_STATS_COMPACT_MAX_RECORDS"]);
	const maxRecords = Number.isFinite(configuredMax) && configuredMax > 0 ? configuredMax : COMPACT_MAX_RECORDS_DEFAULT;
	const seen = /* @__PURE__ */ new Set();
	for (const record of records) if (typeof record.seq === "number" && typeof record.sessionId === "string") seen.add(`${record.sessionId}:${record.seq}`);
	const liveRoutes = /* @__PURE__ */ new Map();
	const collect = (sessionId, seq, model, provider, usage, ts) => {
		if (typeof sessionId !== "string" || !isNonNegativeSafeInteger(seq) || !isValidTimestamp(ts) || sessionId.trim() === "") return;
		if (archive !== null && ts < archive.cutoffTs) return;
		const counters = normalizeUsageCounters(usage);
		if (counters === null) return;
		const key = `${sessionId}:${seq}`;
		if (seen.has(key)) return;
		seen.add(key);
		const record = {
			ts,
			seq,
			sessionId,
			model: labelOrUnknown(model),
			provider: labelOrUnknown(provider),
			...counters
		};
		records.push(record);
		appendRecord(record);
		summaryCache.dirty = true;
	};
	ctx.on("session/event", (session, event) => {
		if (event.type === "request/header") liveRoutes.set(session.id, {
			model: labelOrUnknown(event.data.header.config.model),
			provider: labelOrUnknown(event.data.header.config.provider)
		});
		else if (event.type === "assistant/message" && event.data.usage !== void 0) {
			const route = liveRoutes.get(session.id);
			collect(session.id, event.seq, route?.model ?? "unknown", route?.provider ?? "unknown", event.data.usage, event.time);
		}
	});
	ctx.on("session/disposed", (session) => {
		liveRoutes.delete(session.id);
	});
	/**
	* After a runtime compaction the detail log is shorter than the count the
	* backfill skip-cache was written with, which would force a full resweep at
	* the next boot. Rewrite just that counter and keep the revisions.
	*/
	const refreshBackfillRecordCount = () => {
		const state = loadBackfillState();
		if (state === null) return;
		try {
			writeFileAtomic(BACKFILL_STATE_FILE, JSON.stringify({
				version: 2,
				revisions: state.revisions,
				recordsAtWrite: records.length
			}));
		} catch {}
	};
	/**
	* Fold the eligible detail prefix into the archive once the detail log grows
	* past the retention ceiling. Called at boot AND opportunistically from the
	* summary route, so a host that stays up for weeks still compacts instead of
	* growing the detail log without bound.
	*
	* Order is crash-safe — loadRecords and collect() both ignore detail below
	* `cutoffTs`, so a records rewrite that never lands cannot double-count.
	* @param persistState - boot-path hook that rewrites the full skip-cache.
	*/
	const maybeCompact = (persistState) => {
		if (records.length < maxRecords) return;
		const plan = compactRecords(records, Date.now(), bucketOffsetMinutes);
		if (plan === null) return;
		const aggregate = archive === null ? plan.aggregate : mergeAggregates(archive.aggregate, plan.aggregate);
		const nextArchive = {
			version: 1,
			cutoffTs: plan.cutoffTs,
			aggregate,
			bucketOffsetMinutes: archive === null ? bucketOffsetMinutes : archive.bucketOffsetMinutes ?? 0
		};
		const retainedData = plan.retained.length === 0 ? "" : `${plan.retained.map((record) => JSON.stringify(record)).join("\n")}\n`;
		try {
			writeFileAtomic(ARCHIVE_FILE, JSON.stringify(nextArchive));
			archive = nextArchive;
			records.length = 0;
			records.push(...plan.retained);
			seen.clear();
			for (const record of records) seen.add(`${record.sessionId}:${record.seq}`);
			summaryCache.dirty = true;
			writeFileAtomic(RECORDS_FILE, retainedData);
			if (persistState !== void 0) persistState();
			else refreshBackfillRecordCount();
		} catch {}
	};
	(async () => {
		try {
			const query = ctx.get("sessionQuery");
			if (query === void 0) return;
			const sessions = await query.listSessions();
			const state = loadBackfillState();
			let snapshots = null;
			try {
				const persistence = ctx.get("sessionPersistence");
				if (typeof persistence?.listSnapshots === "function") {
					const listed = await persistence.listSnapshots();
					if (Array.isArray(listed)) {
						const next = /* @__PURE__ */ new Map();
						for (const value of listed) {
							const snapshot = objectOf(value);
							const header = snapshot === null ? null : objectOf(snapshot["header"]);
							if (header !== null && typeof header["id"] === "string" && typeof snapshot?.["revision"] === "string") next.set(header["id"], snapshot["revision"]);
						}
						snapshots = next;
					}
				}
			} catch {
				snapshots = null;
			}
			const stateUsable = state !== null && records.length >= state.recordsAtWrite;
			const revisions = stateUsable ? { ...state.revisions } : {};
			let stateDirty = snapshots !== null && (state === null || !stateUsable);
			const sessionIds = /* @__PURE__ */ new Set();
			for (const entry of sessions) {
				const id = entry.header.id;
				sessionIds.add(id);
				const live = entry.live === true;
				const revision = snapshots?.get(id);
				if (!live && revision !== void 0 && stateUsable && revisions[id] === revision) continue;
				try {
					const log = await query.readSession(id);
					let model = "unknown";
					let provider = "unknown";
					for (const event of log.events) if (event.type === "request/header") {
						model = event.data.header.config.model;
						provider = event.data.header.config.provider;
					} else if (event.type === "assistant/message" && event.data.usage !== void 0) collect(id, event.seq, model, provider, event.data.usage, event.time);
					if (snapshots !== null && revision !== void 0 && revisions[id] !== revision) {
						revisions[id] = revision;
						stateDirty = true;
					}
				} catch {}
			}
			if (snapshots !== null) {
				for (const id of Object.keys(revisions)) if (!snapshots.has(id) && !sessionIds.has(id)) {
					delete revisions[id];
					stateDirty = true;
				}
			}
			const persistBackfillState = () => {
				if (snapshots === null) return;
				try {
					writeFileAtomic(BACKFILL_STATE_FILE, JSON.stringify({
						version: 2,
						revisions,
						recordsAtWrite: records.length
					}));
				} catch {}
			};
			if (stateDirty) persistBackfillState();
			maybeCompact(persistBackfillState);
		} catch {}
	})();
	const lanHosts = readLanHosts();
	ctx.webServer.register({
		kind: "exact",
		path: "/api/stats-panel/summary",
		handler: async (req, res) => {
			if (!isStatsRequestAllowed(req, lanHosts)) {
				writeJson(res, 403, { error: lanHosts.length === 0 ? "forbidden: loopback-only" : "forbidden: undeclared origin" });
				return;
			}
			if (req.method !== "GET" && req.method !== void 0) {
				writeJson(res, 405, { error: `method not allowed: ${req.method}` });
				return;
			}
			maybeCompact();
			if (summaryCache.dirty || summaryCache.value === void 0 || summaryCache.value.dayKeyNow !== dayKey(Date.now(), bucketOffsetMinutes)) {
				summaryCache.value = computeSummary(records, archive?.aggregate, {
					offsetMinutes: bucketOffsetMinutes,
					archiveOffsetMinutes: archive?.bucketOffsetMinutes
				});
				summaryCache.dirty = false;
			}
			writeJson(res, 200, summaryCache.value);
		}
	});
	ctx.webServer.register({
		kind: "exact",
		path: "/api/stats-panel/balances",
		handler: async (req, res) => {
			if (!isStatsRequestAllowed(req, lanHosts)) {
				writeJson(res, 403, { error: lanHosts.length === 0 ? "forbidden: loopback-only" : "forbidden: undeclared origin" });
				return;
			}
			if (req.method !== "GET" && req.method !== void 0) {
				writeJson(res, 405, { error: `method not allowed: ${req.method}` });
				return;
			}
			const CACHE_TTL_MS = 6e4;
			const cached = balancesCache.get();
			if (cached !== void 0 && Date.now() - cached.at < CACHE_TTL_MS) {
				writeJson(res, 200, {
					balances: cached.balances,
					cached: true
				});
				return;
			}
			if (balancesInFlight === void 0) {
				const credentials = ctx.get("credentials");
				const resolveKey = async (name) => {
					if (credentials === void 0 || name === "") return void 0;
					try {
						return (await credentials.resolve(name))?.value;
					} catch {
						return;
					}
				};
				const configs = [];
				const seen = /* @__PURE__ */ new Set();
				for (const config of readProviderConfigs()) {
					if (seen.has(config.provider)) continue;
					seen.add(config.provider);
					configs.push(config);
				}
				const configuredDeadline = Number(process.env["DSH_STATS_BALANCE_DEADLINE_MS"]);
				const deadlineMs = Number.isFinite(configuredDeadline) && configuredDeadline > 0 ? configuredDeadline : BALANCE_PROBE_DEADLINE_MS_DEFAULT;
				balancesInFlight = Promise.all(configs.map(async (config) => {
					let timer;
					const deadline = new Promise((resolve) => {
						timer = setTimeout(() => {
							resolve({
								channel: config.provider,
								kind: "plan",
								displayName: config.displayName,
								error: `查询超时（超过 ${Math.round(deadlineMs / 1e3)} 秒）`
							});
						}, deadlineMs);
					});
					try {
						return await Promise.race([probeChannel(ctx, config, resolveKey), deadline]);
					} catch (e) {
						return {
							channel: config.provider,
							kind: "plan",
							displayName: config.displayName,
							error: `查询失败：${e instanceof Error ? e.message : String(e)}`
						};
					} finally {
						if (timer !== void 0) clearTimeout(timer);
					}
				})).then((results) => {
					balancesCache.set(results);
					return results;
				}).finally(() => {
					balancesInFlight = void 0;
				});
			}
			writeJson(res, 200, { balances: await balancesInFlight });
		}
	});
}
//#endregion
export { aggregateOf, apply, compactRecords, computeSummary, inject, isStatsRequestAllowed, mergeAggregates, name };
