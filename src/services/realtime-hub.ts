import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

// One channel per browser session, regardless of the number of mounted modules.
// Events contain only the module name; authorized data is fetched through the API.
export function createRealtimeHub(client: Pick<SupabaseClient, 'channel' | 'removeChannel'>) {
  const listeners = new Map<string, Set<() => void>>();
  let channel: RealtimeChannel | undefined;
  return (module: string, refresh: () => void) => {
    if (!listeners.has(module)) listeners.set(module, new Set());
    listeners.get(module)!.add(refresh);
    if (!channel) {
      const next = client.channel(`rtg-records:${crypto.randomUUID()}`);
      channel = next;
      next.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'record_changes' }, payload => {
          if (channel !== next) return;
          for (const callback of listeners.get(String(payload.new.module)) || []) callback();
        }).subscribe(status => {
          if (channel !== next) return;
          if (status === 'SUBSCRIBED') for (const callbacks of listeners.values()) for (const callback of callbacks) callback();
        });
    }
    return () => {
      const callbacks = listeners.get(module);
      callbacks?.delete(refresh);
      if (!callbacks?.size) listeners.delete(module);
      if (!listeners.size && channel) {
        const previous = channel;
        // Permission changes replace all module listeners in the same React
        // effect cycle. Reuse the channel instead of racing leave/join requests.
        queueMicrotask(() => {
          if (listeners.size || channel !== previous) return;
          channel = undefined;
          void client.removeChannel(previous);
        });
      }
    };
  };
}
