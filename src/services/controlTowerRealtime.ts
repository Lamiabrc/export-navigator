import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type ControlTowerRefreshPayload = {
  event?: string;
  topic?: string;
  [key: string]: unknown;
};

export type SubscribeControlTowerRefreshParams = {
  supabase: SupabaseClient;
  isPrivate: boolean;
  onRefresh: (payload: ControlTowerRefreshPayload) => void;
  onStatus?: (status: "SUBSCRIBED" | "TIMED_OUT" | "CLOSED" | "CHANNEL_ERROR" | "FALLBACK_PUBLIC") => void;
};

export async function subscribeControlTowerRefresh({
  supabase,
  isPrivate,
  onRefresh,
  onStatus,
}: SubscribeControlTowerRefreshParams): Promise<() => Promise<void>> {
  const topic = "ct:refresh";
  let channel: RealtimeChannel;

  try {
    let usePrivate = isPrivate;

    if (isPrivate) {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const accessToken = data.session?.access_token;
        if (accessToken) {
          await supabase.realtime.setAuth(accessToken);
        } else {
          usePrivate = false;
          console.warn("[ControlTowerRealtime] No session found for private channel; fallback to public channel.");
          onStatus?.("FALLBACK_PUBLIC");
        }
      } catch (error) {
        usePrivate = false;
        console.warn("[ControlTowerRealtime] Failed to initialize private realtime auth; fallback to public.", error);
        onStatus?.("FALLBACK_PUBLIC");
      }
    }

    channel = usePrivate ? supabase.channel(topic, { config: { private: true } }) : supabase.channel(topic);

    channel.on("broadcast", { event: "refresh" }, (payload) => {
      try {
        onRefresh(payload as ControlTowerRefreshPayload);
      } catch (error) {
        console.warn("[ControlTowerRealtime] onRefresh callback failed.", error);
      }
    });

    channel.subscribe((status) => {
      onStatus?.(status);
    });
  } catch (error) {
    console.warn("[ControlTowerRealtime] Subscription setup failed.", error);
    return async () => Promise.resolve();
  }

  return async () => {
    try {
      await channel.unsubscribe();
    } catch (error) {
      console.warn("[ControlTowerRealtime] Failed to unsubscribe channel.", error);
    }

    try {
      await supabase.removeChannel(channel);
    } catch (error) {
      console.warn("[ControlTowerRealtime] Failed to remove channel.", error);
    }
  };
}
