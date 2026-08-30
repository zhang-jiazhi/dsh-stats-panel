import { StatsView } from './stats-panel';
/** Required services (fiber inject waiting — the runtime must be up first). */
export const inject = ['slots'];
/**
 * Mount the usage dashboard as a conversation view tab.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    const slots = ctx.slots;
    slots.inject('conversation.view', () => slots.register({
        name: 'conversation.view',
        id: 'stats',
        order: 40,
        label: () => 'Token 统计',
    }, StatsView));
}
//# sourceMappingURL=index.js.map