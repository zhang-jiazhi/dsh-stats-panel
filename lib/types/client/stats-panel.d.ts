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
import React from 'react';
/** Whether an async response still belongs to the active, non-aborted request. */
export declare function isCurrentRequest(requestId: number, currentId: number, aborted: boolean): boolean;
/**
 * The conversation-view tab body: full-width dashboard. Paints the last
 * page-session payload instantly, then revalidates; auto-refreshes every
 * {@link REFRESH_MS} while the tab is visible. Owns the price table so the
 * cost KPI and the cost columns always agree.
 */
export declare function StatsView(): React.ReactElement;
//# sourceMappingURL=stats-panel.d.ts.map