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
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { StatsView } from './stats-panel'

/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots']

/**
 * Structural subset of the slot registry used here, typed loosely on
 * purpose: the SlotMap augmentation for `conversation.view` lives in
 * `@deepseek-ai/dsh-client-ui-conversation`, which this plugin does not pin.
 * The runtime contract (a list-slot entry carries `id`/`order`/`label`) is
 * what dsh-context and dsh-mneme already rely on for their tabs.
 */
interface SlotRegistry {
  inject: (name: string, factory: () => unknown) => void
  register: (options: Record<string, unknown>, component: unknown) => unknown
}

/**
 * Mount the usage dashboard as a conversation view tab.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const slots = ctx.slots as unknown as SlotRegistry
  slots.inject('conversation.view', () => slots.register({
    name: 'conversation.view',
    id: 'stats',
    order: 40,
    label: () => 'Token 统计',
  }, StatsView))
}
