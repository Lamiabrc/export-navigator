import { useMemo, useEffect, useState } from "react";

import { CompanyProfileModal } from "@/components/CompanyProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/auth/PlanContext";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

const DISMISS_KEY_PREFIX = "mpl_company_profile_dismissed_";

export function CompanyProfileGuard() {
  const { plan } = usePlan();
  const { isAuthenticated, user } = useAuth();
  const { profile, needsProfile, loading, saveProfile, error } = useCompanyProfile();

  const dismissKey = useMemo(
    () => (user?.id ? `${DISMISS_KEY_PREFIX}${user.id}` : `${DISMISS_KEY_PREFIX}anon`),
    [user?.id]
  );

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!user?.id) {
      setDismissed(false);
      return;
    }
    const stored = window.localStorage.getItem(dismissKey);
    setDismissed(stored === "1");
  }, [dismissKey, user?.id]);

  const open = useMemo(
    () => plan === "FREE" && needsProfile && isAuthenticated && !loading && !dismissed && !error,
    [plan, needsProfile, isAuthenticated, loading, dismissed, error]
  );

  const initialValues = useMemo(
    () =>
      profile
        ? {
            companyName: profile.company_name,
            addressLine1: profile.address_line1,
            city: profile.city,
            postalCode: profile.postal_code,
            country: profile.country,
          }
        : undefined,
    [profile],
  );

  const handleSave = async (values: {
    companyName: string;
    addressLine1: string;
    city: string;
    postalCode: string;
    country: string;
  }) => {
    return saveProfile({
      company_name: values.companyName,
      address_line1: values.addressLine1,
      address_line2: null,
      city: values.city,
      postal_code: values.postalCode,
      country: values.country,
    });
  };

  const handleSkip = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey, "1");
    }
    setDismissed(true);
  };

  return (
    <CompanyProfileModal
      open={open}
      initialValues={initialValues}
      onSave={handleSave}
      loading={loading}
      onSkip={handleSkip}
    />
  );
}
