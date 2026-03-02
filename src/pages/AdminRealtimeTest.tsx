import * as React from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { Link } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isAdminUser } from "@/lib/authz";

type DebugTable = "company_profiles" | "hs_search_logs" | "chat_events" | "regulatory_items";

type Status = "idle" | "subscribing" | "subscribed" | "closed" | "error";

type RealtimeEventRow = {
  id: string;
  receivedAt: string;
  eventType: string;
  commitTimestamp?: string;
  schema: string;
  table: string;
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>;
};

const TABLE_OPTIONS: Array<{ value: DebugTable; label: string }> = [
  { value: "company_profiles", label: "company_profiles" },
  { value: "hs_search_logs", label: "hs_search_logs" },
  { value: "chat_events", label: "chat_events" },
  { value: "regulatory_items", label: "regulatory_items" },
];

function statusLabel(status: Status) {
  switch (status) {
    case "subscribing":
      return "Connecting";
    case "subscribed":
      return "Live";
    case "closed":
      return "Stopped";
    case "error":
      return "Error";
    default:
      return "Idle";
  }
}

function statusVariant(status: Status): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "subscribed":
      return "default";
    case "subscribing":
      return "secondary";
    case "error":
      return "destructive";
    case "closed":
      return "outline";
    default:
      return "outline";
  }
}

export default function AdminRealtimeTest() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [selectedTable, setSelectedTable] = React.useState<DebugTable>("company_profiles");
  const [status, setStatus] = React.useState<Status>("idle");
  const [lastMessage, setLastMessage] = React.useState<string>("Not listening yet.");
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [events, setEvents] = React.useState<RealtimeEventRow[]>([]);

  const channelRef = React.useRef<RealtimeChannel | null>(null);

  const stopListening = React.useCallback(async () => {
    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setStatus("closed");
    setLastMessage("Channel stopped.");
  }, []);

  const startListening = React.useCallback(async () => {
    setErrorMessage("");

    if (!SUPABASE_ENV_OK) {
      setStatus("error");
      setErrorMessage("Supabase env missing. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
      return;
    }

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    setEvents([]);
    setStatus("subscribing");
    setLastMessage(`Subscribing to public.${selectedTable}...`);

    const channel = supabase.channel(`rt-debug-${selectedTable}-${Date.now()}`);

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: selectedTable },
      (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
        const eventRow: RealtimeEventRow = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          receivedAt: new Date().toISOString(),
          eventType: payload.eventType,
          commitTimestamp: payload.commit_timestamp,
          schema: payload.schema,
          table: payload.table,
          payload,
        };

        setEvents((prev) => [eventRow, ...prev].slice(0, 50));
        setLastMessage(`Received ${payload.eventType} on public.${payload.table}`);
      }
    );

    channel.subscribe((channelStatus) => {
      if (channelStatus === "SUBSCRIBED") {
        setStatus("subscribed");
        setLastMessage(`Listening on public.${selectedTable}`);
        return;
      }

      if (channelStatus === "CHANNEL_ERROR" || channelStatus === "TIMED_OUT") {
        setStatus("error");
        setErrorMessage(`Realtime status: ${channelStatus}. Verify publication and RLS.`);
        return;
      }

      if (channelStatus === "CLOSED") {
        setStatus("closed");
        setLastMessage("Channel closed.");
      }
    });

    channelRef.current = channel;
  }, [selectedTable]);

  React.useEffect(() => {
    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  if (!isAdmin) {
    return (
      <AppLayout>
        <Card>
          <CardHeader>
            <CardTitle>Admin access required</CardTitle>
            <CardDescription>This page is only available for admin users.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link to="/app/control-tower">Back to Control Tower</Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Realtime debug (postgres_changes)</CardTitle>
            <CardDescription>
              Select a table, start listening, then insert/update rows from another tab or API call.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[280px_auto]">
              <div className="space-y-2">
                <p className="text-sm font-medium">Table</p>
                <Select value={selectedTable} onValueChange={(v) => setSelectedTable(v as DebugTable)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a table" />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <Button onClick={() => void startListening()} disabled={status === "subscribing"}>
                  Start listening
                </Button>
                <Button onClick={() => void stopListening()} variant="outline">
                  Stop
                </Button>
                <Button onClick={() => setEvents([])} variant="ghost">
                  Clear events
                </Button>
                <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">{lastMessage}</p>
            {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live payloads (max 50)</CardTitle>
            <CardDescription>Newest events are shown first.</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[520px] rounded-md border">
              <div className="space-y-3 p-3">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No events received yet.</p>
                ) : (
                  events.map((item) => (
                    <div key={item.id} className="rounded-md border bg-muted/20 p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{item.eventType}</Badge>
                        <span>{item.schema}.{item.table}</span>
                        <span>{new Date(item.receivedAt).toLocaleString()}</span>
                      </div>
                      <pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-all text-xs">
                        {JSON.stringify(item.payload, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual test</CardTitle>
            <CardDescription>Quick verification checklist.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Open this page and select <code>company_profiles</code> or <code>hs_search_logs</code>.</p>
            <p>2. Click <code>Start listening</code>.</p>
            <p>3. Trigger an insert (create/update company profile or send one Copilot request).</p>
            <p>4. Confirm a payload appears instantly in the list above.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
