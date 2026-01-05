import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

export type CompetitorEvent = {
  id: string;
  event_date: string | null;
  competitor_id: string | null;
  territory_code?: string | null;
  kind: string | null;
  title: string | null;
  details?: string | null;
  source?: string | null;
  impact_score?: number | null;
  created_at?: string | null;
};

export type EventFilters = {
  from?: string;
  to?: string;
  territories?: string[];
  competitors?: string[];
  kinds?: string[];
};

type State<T> = { data: T; loading: boolean; error: string | null; warning?: string };

export function useCompetitorEvents(filters: EventFilters = {}) {
  const [state, setState] = useState<State<CompetitorEvent[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        if (active) setState({ data: [], loading: false, error: null, warning: "Supabase non configuré" });
        return;
      }
      try {
        const query = supabase
          .from("competitor_events")
          .select("*")
          .order("event_date", { ascending: false })
          .limit(400);

        if (filters.from) query.gte("event_date", filters.from);
        if (filters.to) query.lte("event_date", filters.to);
        if (filters.territories?.length) query.in("territory_code", filters.territories);
        if (filters.competitors?.length) query.in("competitor_id", filters.competitors);
        if (filters.kinds?.length) query.in("kind", filters.kinds);

        const { data, error } = await query;
        if (!active) return;
        if (error) {
          if (isMissingTableError(error)) {
            setState({ data: [], loading: false, error: null, warning: "Table competitor_events absente" });
          } else {
            setState({ data: [], loading: false, error: error.message });
          }
          return;
        }

        setState({ data: (data ?? []) as CompetitorEvent[], loading: false, error: null });
      } catch (err: any) {
        if (!active) return;
        setState({ data: [], loading: false, error: err?.message || "Erreur chargement événements" });
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [filters.from, filters.to, JSON.stringify(filters.territories || []), JSON.stringify(filters.competitors || []), JSON.stringify(filters.kinds || [])]);

  const addEvent = async (payload: Partial<CompetitorEvent>) => {
    if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré");
    const { error } = await supabase.from("competitor_events").insert({
      ...payload,
      event_date: payload.event_date || new Date().toISOString().slice(0, 10),
    });
    if (error) throw error;
  };

  const groupedByDay = useMemo(() => {
    const map = new Map<string, CompetitorEvent[]>();
    state.data.forEach((e) => {
      const day = e.event_date || "NA";
      const arr = map.get(day) || [];
      arr.push(e);
      map.set(day, arr);
    });
    return map;
  }, [state.data]);

  return { state, addEvent, groupedByDay };
}
