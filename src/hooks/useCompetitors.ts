import { useEffect, useMemo, useState } from "react";
import { supabase, SUPABASE_ENV_OK } from "@/integrations/supabase/client";
import { isMissingTableError } from "@/domain/calc";

export type Competitor = {
  id: string;
  name: string;
  brand?: string | null;
  notes?: string | null;
  active?: boolean | null;
  created_at?: string | null;
};

export type CompetitorPresence = {
  id: string;
  competitor_id: string;
  territory_code: string | null;
  channel: string | null;
  distributor: string | null;
  active?: boolean | null;
};

type State<T> = {
  data: T;
  loading: boolean;
  error: string | null;
  warning?: string;
};

export function useCompetitors() {
  const [competitors, setCompetitors] = useState<State<Competitor[]>>({
    data: [],
    loading: true,
    error: null,
  });
  const [presence, setPresence] = useState<State<CompetitorPresence[]>>({
    data: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!SUPABASE_ENV_OK) {
        if (active) {
          setCompetitors((s) => ({ ...s, data: [], loading: false, warning: "Supabase non configuré" }));
          setPresence((s) => ({ ...s, data: [], loading: false, warning: "Supabase non configuré" }));
        }
        return;
      }
      try {
        const [compRes, presRes] = await Promise.all([
          supabase.from("competitors").select("*").order("name", { ascending: true }),
          supabase.from("competitor_presence").select("*").order("territory_code", { ascending: true }),
        ]);

        if (!active) return;

        if (compRes.error) {
          if (isMissingTableError(compRes.error)) {
            setCompetitors({ data: [], loading: false, error: null, warning: "Table competitors absente" });
          } else {
            setCompetitors({ data: [], loading: false, error: compRes.error.message });
          }
        } else {
          setCompetitors({ data: (compRes.data ?? []) as Competitor[], loading: false, error: null });
        }

        if (presRes.error) {
          if (isMissingTableError(presRes.error)) {
            setPresence({ data: [], loading: false, error: null, warning: "Table competitor_presence absente" });
          } else {
            setPresence({ data: [], loading: false, error: presRes.error.message });
          }
        } else {
          setPresence({ data: (presRes.data ?? []) as CompetitorPresence[], loading: false, error: null });
        }
      } catch (err: any) {
        if (!active) return;
        setCompetitors({ data: [], loading: false, error: err?.message || "Erreur chargement concurrents" });
        setPresence({ data: [], loading: false, error: err?.message || "Erreur chargement présence" });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, []);

  const saveCompetitor = async (payload: Partial<Competitor>) => {
    if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré");
    const { error } = await supabase.from("competitors").upsert(payload, { onConflict: "id" });
    if (error) throw error;
  };

  const savePresence = async (payload: Partial<CompetitorPresence>) => {
    if (!SUPABASE_ENV_OK) throw new Error("Supabase non configuré");
    const { error } = await supabase.from("competitor_presence").upsert(payload, { onConflict: "id" });
    if (error) throw error;
  };

  const competitorsById = useMemo(() => {
    const map = new Map<string, Competitor>();
    competitors.data.forEach((c) => map.set(c.id, c));
    return map;
  }, [competitors.data]);

  return {
    competitors,
    presence,
    saveCompetitor,
    savePresence,
    competitorsById,
  };
}
