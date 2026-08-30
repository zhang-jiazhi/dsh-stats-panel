/**
 * Browser-half entry for the dsh-stats-panel plugin — runs inside the dsh
 * web GUI.
 *
 * Registers one top-level conversation view (`conversation.view`): the tab
 * "Token 统计" sits beside 对话 / 轨迹 / 上下文 / 记忆 and opens a
 * full-page usage dashboard, reading data from the host half over plain
 * same-origin fetch (`/api/stats-panel/summary`). Failure policy: rendering
 * problems are contained inside the view, never thrown — an external plugin
 * must not take the GUI down.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
/** Required services (fiber inject waiting — the runtime must be up first). */
export declare const inject: string[];
/**
 * Mount the usage dashboard as a conversation view tab.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map