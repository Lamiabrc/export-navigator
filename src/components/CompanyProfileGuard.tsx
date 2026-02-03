import { useMemo } from "react";

import { CompanyProfileModal } from "@/components/CompanyProfileModal";
import { useAuth } from "@/contexts/AuthContext";
import { usePlan } from "@/auth/PlanContext";
import { useCompanyProfile } from "@/hooks/useCompanyProfile";

export function CompanyProfileGuard() {
  const { plan } = usePlan();
  const { isAuthenticated } = useAuth();
  const { profile, needsProfile, loading, saveProfile } = useCompanyProfile();

  const open = useMemo(() => plan === "FREE" && needsProfile && isAuthenticated && !loading, [
    plan,
    needsProfile,
    isAuthenticated,
    loading,
  ]);

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

  return <CompanyProfileModal open={open} initialValues={initialValues} onSave={handleSave} loading={loading} />;
}
