import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const COUNTRY_OPTIONS = [
  { value: "FR", label: "France" },
  { value: "US", label: "United States" },
  { value: "DE", label: "Germany" },
  { value: "GB", label: "United Kingdom" },
  { value: "ES", label: "Spain" },
  { value: "IT", label: "Italy" },
  { value: "CN", label: "China" },
  { value: "AE", label: "United Arab Emirates" },
  { value: "MA", label: "Morocco" },
  { value: "CA", label: "Canada" },
];

type FormValues = {
  companyName: string;
  addressLine1: string;
  city: string;
  postalCode: string;
  country: string;
};

type Props = {
  open: boolean;
  initialValues?: FormValues;
  onSave: (payload: FormValues) => Promise<void>;
  loading?: boolean;
};

export function CompanyProfileModal({ open, initialValues, onSave, loading }: Props) {
  const { t } = useI18n();
  const { toast } = useToast();

  const [values, setValues] = React.useState<FormValues>(
    initialValues ?? {
      companyName: "",
      addressLine1: "",
      city: "",
      postalCode: "",
      country: "FR",
    },
  );

  React.useEffect(() => {
    if (initialValues) {
      setValues(initialValues);
    }
  }, [initialValues]);

  const handleChange = (field: keyof FormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const missing = Object.entries(values).filter(([, value]) => !value.trim());
    if (missing.length > 0) {
      toast({
        title: t("companyProfile.errors.missing") as string,
        description: t("companyProfile.errors.help") as string,
      });
      return;
    }

    try {
      await onSave(values);
      toast({ title: t("companyProfile.success.title") as string, description: t("companyProfile.success.description") as string });
    } catch (err: any) {
      toast({ title: t("companyProfile.errors.saveTitle") as string, description: err?.message || t("companyProfile.errors.saveBody") });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80" aria-hidden />
      <section
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
      >
        <header className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            {t("companyProfile.title")}
          </h2>
          <p className="text-sm text-slate-600">{t("companyProfile.description")}</p>
        </header>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <Label htmlFor="companyName">{t("companyProfile.fields.companyName")}</Label>
            <Input
              id="companyName"
              value={values.companyName}
              onChange={(event) => handleChange("companyName", event.target.value)}
              placeholder={t("companyProfile.placeholders.companyName")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="addressLine1">{t("companyProfile.fields.addressLine1")}</Label>
            <Input
              id="addressLine1"
              value={values.addressLine1}
              onChange={(event) => handleChange("addressLine1", event.target.value)}
              placeholder={t("companyProfile.placeholders.addressLine1")}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="city">{t("companyProfile.fields.city")}</Label>
              <Input
                id="city"
                value={values.city}
                onChange={(event) => handleChange("city", event.target.value)}
                placeholder={t("companyProfile.placeholders.city")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="postalCode">{t("companyProfile.fields.postalCode")}</Label>
              <Input
                id="postalCode"
                value={values.postalCode}
                onChange={(event) => handleChange("postalCode", event.target.value)}
                placeholder={t("companyProfile.placeholders.postalCode")}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="country">{t("companyProfile.fields.country")}</Label>
            <select
              id="country"
              value={values.country}
              onChange={(event) => handleChange("country", event.target.value)}
              className="flex h-10 w-full items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 transition focus:border-slate-900 focus:outline-none"
            >
              {COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <footer className="mt-6 flex items-center justify-end gap-3">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t("companyProfile.actions.saving") : t("companyProfile.actions.save")}
          </Button>
        </footer>
      </section>
    </div>
  );
}
