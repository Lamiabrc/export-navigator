import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CompanyProfile = {
  user_id: string;
  company_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
  updated_at: string;
};

export function useCompanyProfile() {
  const { user } = useAuth();

  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoCreatedRef = useRef(false);

  const needsProfile = useMemo(() => {
    if (!profile) return true;
    if (!profile.company_name || !profile.address_line1 || !profile.city || !profile.postal_code || !profile.country) {
      return true;
    }
    return false;
  }, [profile]);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: supabaseError } = await supabase
      .from("company_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (supabaseError) {
      setError(supabaseError.message);
      setProfile(null);
    } else {
      setError(null);
      setProfile(data ?? null);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;
    if (profile) return;
    if (autoCreatedRef.current) return;

    const companyName = (user.user_metadata?.company_name as string | undefined)?.trim();
    if (!companyName) return;

    const country = (user.user_metadata?.country as string | undefined)?.trim();
    autoCreatedRef.current = true;

    void (async () => {
      const { error: supabaseError } = await supabase
        .from("company_profiles")
        .upsert(
          {
            user_id: user.id,
            company_name: companyName,
            country: country || "FR",
          },
          { onConflict: "user_id" }
        );

      if (supabaseError) {
        setError(supabaseError.message);
        return;
      }

      await loadProfile();
    })();
  }, [user, profile, loadProfile]);

  const saveProfile = useCallback(
    async (payload: Omit<CompanyProfile, "user_id" | "created_at" | "updated_at">) => {
      if (!user) throw new Error("Utilisateur non connecté");

      const body = {
        user_id: user.id,
        ...payload,
      };

      const { error: supabaseError } = await supabase
        .from("company_profiles")
        .upsert(body, { onConflict: "user_id" });

      if (supabaseError) {
        throw supabaseError;
      }

      await loadProfile();
    },
    [loadProfile, user],
  );

  return {
    profile,
    loading,
    error,
    needsProfile,
    refresh: loadProfile,
    saveProfile,
  };
}
