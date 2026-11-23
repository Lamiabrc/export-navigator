import * as React from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";
import { PlanProvider } from "@/auth/PlanContext";
import { RequirePlan } from "@/components/RequirePlan";
import { CompanyProfileGuard } from "@/components/CompanyProfileGuard";
import { CookieConsent } from "@/components/CookieConsent";
import { EnvMissingBanner } from "@/components/EnvMissingBanner";
import { lazyWithReload } from "@/lib/lazyWithReload";

import Home from "@/pages/Home";
const AboutPage = lazyWithReload(() => import("@/pages/About"));
const ShareDecision = lazyWithReload(() => import("@/pages/ShareDecision"));
const Methodologie = lazyWithReload(() => import("@/pages/Methodologie"));
const Guide = lazyWithReload(() => import("@/pages/Guide"));
const Incoterms = lazyWithReload(() => import("@/pages/Incoterms"));
const IncotermDetail = lazyWithReload(() => import("@/pages/IncotermDetail"));
const InfoParameter = lazyWithReload(() => import("@/pages/InfoParameter"));
const WatchCenter = lazyWithReload(() => import("@/pages/WatchCenter"));
const WatchRegulatory = lazyWithReload(() => import("@/pages/WatchRegulatory"));
const WatchCommercial = lazyWithReload(() => import("@/pages/WatchCommercial"));
const InvoiceCheck = lazyWithReload(() => import("@/pages/InvoiceCheck"));
const Newsletter = lazyWithReload(() => import("@/pages/Newsletter"));
const HeroVideoPreview = lazyWithReload(() => import("@/pages/HeroVideoPreview"));
const Login = lazyWithReload(() => import("@/pages/Login"));
const Register = lazyWithReload(() => import("@/pages/Register"));
const ForgotPassword = lazyWithReload(() => import("@/pages/ForgotPassword"));
const SetPassword = lazyWithReload(() => import("@/pages/SetPassword"));
const ControlTower = lazyWithReload(() => import("@/pages/ControlTower"));
const ExportSimulator = lazyWithReload(() => import("@/pages/ExportSimulator"));
const Simulator = lazyWithReload(() => import("@/pages/Simulator"));
const DealsBoard = lazyWithReload(() => import("@/pages/DealsBoard"));
const DealDetail = lazyWithReload(() => import("@/pages/DealDetail"));
const DossierWizard = lazyWithReload(() => import("@/pages/DossierWizard"));
const DashboardVentes = lazyWithReload(() => import("@/pages/DashboardVentes"));
const MarketFinder = lazyWithReload(() => import("@/pages/MarketFinder"));
const LeadTemplates = lazyWithReload(() => import("@/pages/LeadTemplates"));
const InvoiceDetail = lazyWithReload(() => import("@/pages/InvoiceDetail"));
const Admin = lazyWithReload(() => import("@/pages/Admin"));
const Assistant = lazyWithReload(() => import("@/pages/Assistant"));
const Settings = lazyWithReload(() => import("@/pages/Settings"));
const NotFound = lazyWithReload(() => import("@/pages/NotFound"));
const Solutions = lazyWithReload(() => import("@/pages/Solutions"));
const Resources = lazyWithReload(() => import("@/pages/Resources"));
const Contact = lazyWithReload(() => import("@/pages/Contact"));
const TestExportIA = lazyWithReload(() => import("@/pages/TestExportIA"));
const Sondage = lazyWithReload(() => import("@/pages/Sondage"));
const AuditInterne = lazyWithReload(() => import("@/pages/Compliance"));
const InternalResources = lazyWithReload(() => import("@/pages/InternalResources"));
const ExportToFrance = lazyWithReload(() => import("@/pages/ExportToFrance"));
const BillingSuccess = lazyWithReload(() => import("@/pages/BillingSuccess"));
const Account = lazyWithReload(() => import("@/pages/Account"));
const Pricing = lazyWithReload(() => import("@/pages/Pricing"));
const HistoryPage = lazyWithReload(() => import("@/pages/History"));
const ImportCheckInvoice = lazyWithReload(() => import("@/pages/ImportCheckInvoice"));
const PublicAppGate = lazyWithReload(() => import("@/pages/PublicAppGate"));
const VipRentability = lazyWithReload(() => import("@/pages/VipRentability"));
const Legal = lazyWithReload(() => import("@/pages/Legal"));
const AdminKbDocs = lazyWithReload(() => import("@/pages/AdminKbDocs"));
const AdminData = lazyWithReload(() => import("@/pages/AdminData"));
const AdminRealtimeTest = lazyWithReload(() => import("@/pages/AdminRealtimeTest"));
const TaxesOm = lazyWithReload(() => import("@/pages/TaxesOm"));
const Prospection = lazyWithReload(() => import("@/pages/Prospection"));
const BusinessRelations = lazyWithReload(() => import("@/pages/BusinessRelations"));

const queryClient = new QueryClient();
const LazyFallback = () => <div className="min-h-screen bg-white" aria-busy="true" />;
const LegacyDealRedirect = () => {
  const params = useParams();
  const dealId = params.dealId || "";
  return <Navigate to={`/app/deals/${dealId}`} replace />;
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ThemeProvider defaultTheme="light" storageKey="mpl-ui-theme">
            <Toaster />
            <Sonner />

            <PlanProvider>
              <LanguageProvider persist="local">
                <BrowserRouter>
                  <CookieConsent />
                  <EnvMissingBanner />
                  <CompanyProfileGuard />
                  <GlobalFiltersProvider>
                    <React.Suspense fallback={<LazyFallback />}>
                      <Routes>
                        {/* ===================== Marketing / Public ===================== */}
                        <Route path="/" element={<Home />} />
                        <Route path="/copilote" element={<Navigate to="/pricing" replace />} />
                        <Route path="/control-tower" element={<Navigate to="/app/control-tower" replace />} />

                        {/* ✅ Outils publics => accès app uniquement */}
                        <Route path="/verifier-facture" element={<PublicAppGate mode="invoice-check" />} />
                        <Route path="/tool" element={<Navigate to="/verifier-facture" replace />} />

                        <Route path="/services" element={<Navigate to="/pricing" replace />} />
                        <Route path="/conseil-audit-export" element={<Navigate to="/pricing" replace />} />

                        {/* ✅ EN/legacy marketing (Watch supprimée => redirect) */}
                        <Route path="/watch" element={<Navigate to="/veille" replace />} />
                        {/* ✅ FR canonique */}
                        <Route path="/veille" element={<PublicAppGate mode="watch" />} />

                        <Route path="/about" element={<AboutPage />} />
                        <Route path="/pricing" element={<Pricing />} />
                        <Route path="/prospection" element={<Prospection />} />
                        <Route path="/coin-business" element={<Navigate to="/" replace />} />
                        <Route path="/business" element={<Navigate to="/" replace />} />

                        {/* ✅ pages publiques */}
                        <Route path="/analyse" element={<PublicAppGate mode="analyse" />} />
                        <Route path="/share/:id" element={<ShareDecision />} />
                        <Route path="/methodologie" element={<Methodologie />} />

                        {/* ✅ guides */}
                        <Route path="/guides" element={<Navigate to="/resources" replace />} />
                        <Route path="/guides/incoterms" element={<Incoterms />} />
                        <Route path="/guides/incoterms-:code" element={<IncotermDetail />} />
                        <Route path="/guides/:slug" element={<Guide />} />
                        <Route path="/infos/:slug" element={<InfoParameter />} />

                        <Route path="/solutions" element={<Solutions />} />
                        <Route path="/resources" element={<Resources />} />
                        <Route path="/tarifs" element={<Navigate to="/pricing" replace />} />
                        <Route path="/tarif" element={<Navigate to="/pricing" replace />} />
                        <Route path="/offre" element={<Navigate to="/pricing" replace />} />
                        <Route path="/offres" element={<Navigate to="/pricing" replace />} />
                        <Route path="/abonnement" element={<Navigate to="/pricing" replace />} />
                        <Route path="/abonnements" element={<Navigate to="/pricing" replace />} />
                        <Route path="/plans" element={<Navigate to="/pricing" replace />} />
                        <Route path="/plan" element={<Navigate to="/pricing" replace />} />

                        <Route path="/contact" element={<Contact />} />
                        <Route path="/test-export-ia" element={<TestExportIA />} />
                        <Route path="/sondage" element={<Sondage />} />
                        <Route path="/test" element={<Navigate to="/test-export-ia" replace />} />
                        <Route path="/billing/success" element={<BillingSuccess />} />
                        <Route path="/export-to-france" element={<ExportToFrance />} />
                        <Route path="/newsletter" element={<Newsletter />} />
                        <Route path="/debug/hero-video" element={<HeroVideoPreview />} />

                        {/* ✅ outil gratuit (public) */}
                        <Route path="/export/costing" element={<PublicAppGate mode="costing" />} />

                        {/* ===================== PRO/VIP (derrière login) ===================== */}
                        <Route
                          path="/history"
                          element={
                            <ProtectedRoute>
                              <RequirePlan minPlan="PRO_ONLINE">
                                <HistoryPage />
                              </RequirePlan>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/import/check-invoice"
                          element={
                            <ProtectedRoute>
                              <RequirePlan minPlan="PRO_VISIO">
                                <ImportCheckInvoice />
                              </RequirePlan>
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/vip/rentability"
                          element={
                            <ProtectedRoute>
                              <RequirePlan minPlan="PILOTAGE_HEBDO">
                                <VipRentability />
                              </RequirePlan>
                            </ProtectedRoute>
                          }
                        />

                        {/* ===================== Legal ===================== */}
                        <Route path="/legal/:slug" element={<Legal />} />
                        <Route path="/mentions-legales" element={<Navigate to="/legal/mentions-legales" replace />} />
                        <Route path="/confidentialite" element={<Navigate to="/legal/confidentialite" replace />} />
                        <Route path="/cookies" element={<Navigate to="/legal/cookies" replace />} />
                        <Route path="/cgu" element={<Navigate to="/legal/cgu" replace />} />
                        <Route path="/cgv" element={<Navigate to="/legal/cgv" replace />} />

                        {/* ===================== Auth ===================== */}
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/forgot-password" element={<ForgotPassword />} />
                        <Route path="/set-password" element={<SetPassword />} />

                        <Route
                          path="/account"
                          element={
                            <ProtectedRoute>
                              <Account />
                            </ProtectedRoute>
                          }
                        />

                        {/* ===================== App (privé) ===================== */}
                        <Route path="/tour-de-controle" element={<Navigate to="/app/control-tower" replace />} />

                        <Route
                          path="/app/control-tower"
                          element={
                            <ProtectedRoute>
                              <ControlTower />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/app/command-center" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/app" element={<Navigate to="/app/control-tower" replace />} />

                        <Route
                          path="/app/sales-dashboard"
                          element={
                            <ProtectedRoute>
                              <DashboardVentes />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/explore"
                          element={
                            <ProtectedRoute>
                              <DashboardVentes />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/deals"
                          element={
                            <ProtectedRoute>
                              <DealsBoard mode="deals" />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/deals/:dealId"
                          element={
                            <ProtectedRoute>
                              <DealDetail mode="deals" />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/dossiers"
                          element={
                            <ProtectedRoute>
                              <DealsBoard mode="dossiers" />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/dossiers/new"
                          element={
                            <ProtectedRoute>
                              <DossierWizard />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/dossiers/:dealId"
                          element={
                            <ProtectedRoute>
                              <DealDetail mode="dossiers" />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/market-finder"
                          element={
                            <ProtectedRoute>
                              <MarketFinder />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/lead-templates"
                          element={
                            <ProtectedRoute>
                              <LeadTemplates />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/mise-en-relation"
                          element={
                            <ProtectedRoute>
                              <BusinessRelations />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/app/business" element={<Navigate to="/app/mise-en-relation" replace />} />
                        <Route path="/app/business-relations" element={<Navigate to="/app/mise-en-relation" replace />} />

                        <Route
                          path="/app/invoices/:invoiceNumber"
                          element={
                            <ProtectedRoute>
                              <InvoiceDetail />
                            </ProtectedRoute>
                          }
                        />

                        {/* ✅ Anciennes routes taxes (legacy) => redirection */}
                        <Route
                          path="/app/droits-taxes"
                          element={
                            <ProtectedRoute>
                              <TaxesOm />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/taxes-om"
                          element={
                            <ProtectedRoute>
                              <TaxesOm />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/taxes"
                          element={
                            <ProtectedRoute>
                              <Navigate to="/app/taxes-om" replace />
                            </ProtectedRoute>
                          }
                        />

                        {/* ✅ simulateur */}
                        <Route
                          path="/app/simulator"
                          element={
                            <ProtectedRoute>
                              <ExportSimulator />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/simulator-legacy"
                          element={
                            <ProtectedRoute>
                              <Simulator />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/centre-veille"
                          element={
                            <ProtectedRoute>
                              <WatchCenter />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/centre-veille/reglementation"
                          element={
                            <ProtectedRoute>
                              <WatchRegulatory />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/veille"
                          element={
                            <ProtectedRoute>
                              <Navigate to="/app/centre-veille/reglementation" replace />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/centre-veille/secteurs"
                          element={
                            <ProtectedRoute>
                              <WatchCommercial />
                            </ProtectedRoute>
                          }
                        />
                        <Route path="/app/centre-veille/concurrence" element={<Navigate to="/app/centre-veille/secteurs" replace />} />

                        <Route
                          path="/app/produits"
                          element={
                            <ProtectedRoute>
                              <Navigate to="/app/taxes-om" replace />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/assistant"
                          element={
                            <ProtectedRoute>
                              <Assistant />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/app/expert"
                          element={
                            <ProtectedRoute>
                              <Assistant />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/invoice-check"
                          element={
                            <ProtectedRoute>
                              <InvoiceCheck />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/audit-interne"
                          element={
                            <ProtectedRoute>
                              <AuditInterne />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/compliance"
                          element={
                            <ProtectedRoute>
                              <Navigate to="/app/audit-interne" replace />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/admin"
                          element={
                            <ProtectedRoute>
                              <Admin />
                            </ProtectedRoute>
                          }
                        />

                        {/* ✅ NOUVEAU : gestion PDFs (privé) */}
                        <Route
                          path="/app/admin/data"
                          element={
                            <ProtectedRoute>
                              <AdminData />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/admin/kb-docs"
                          element={
                            <ProtectedRoute>
                              <AdminKbDocs />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/admin/realtime"
                          element={
                            <ProtectedRoute>
                              <AdminRealtimeTest />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/settings"
                          element={
                            <ProtectedRoute>
                              <Settings />
                            </ProtectedRoute>
                          }
                        />

                        <Route
                          path="/app/internal/resources"
                          element={
                            <ProtectedRoute>
                              <InternalResources />
                            </ProtectedRoute>
                          }
                        />

                        {/* ===================== Aliases / Legacy ===================== */}
                        <Route path="/welcome" element={<Navigate to="/pricing" replace />} />
                        <Route path="/ressources" element={<Navigate to="/resources" replace />} />

                        <Route path="/hub" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/command-center" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/dashboard" element={<Navigate to="/app/control-tower" replace />} />
                        <Route path="/explore" element={<Navigate to="/app/explore" replace />} />
                        <Route path="/sales" element={<Navigate to="/app/sales-dashboard" replace />} />
                        <Route path="/deals" element={<Navigate to="/app/deals" replace />} />
                        <Route path="/dossiers" element={<Navigate to="/app/dossiers" replace />} />
                        <Route path="/deal/:dealId" element={<LegacyDealRedirect />} />
                        <Route path="/market-finder" element={<Navigate to="/app/market-finder" replace />} />
                        <Route path="/lead-finder" element={<Navigate to="/app/lead-templates" replace />} />

                        <Route path="/taxes-om" element={<Navigate to="/app/taxes-om" replace />} />
                        <Route path="/taxes" element={<Navigate to="/app/taxes-om" replace />} />

                        <Route path="/simulator" element={<Navigate to="/app/simulator" replace />} />
                        <Route path="/watch/regulatory" element={<Navigate to="/app/centre-veille/reglementation" replace />} />

                        <Route path="/watch/commercial" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                        <Route path="/watch/competitive" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                        <Route path="/competition" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                        <Route path="/concurrence" element={<Navigate to="/app/centre-veille/secteurs" replace />} />

                        <Route path="/products" element={<Navigate to="/app/produits" replace />} />
                        <Route path="/invoice-check" element={<Navigate to="/app/invoice-check" replace />} />
                        <Route path="/assistant" element={<Navigate to="/app/assistant" replace />} />
                        <Route path="/expert" element={<Navigate to="/app/expert" replace />} />
                        <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
                        <Route path="/admin/realtime" element={<Navigate to="/app/admin/realtime" replace />} />
                        <Route path="/app/centre-conformite" element={<Navigate to="/app/audit-interne" replace />} />
                        <Route path="/app/controls" element={<Navigate to="/app/audit-interne" replace />} />
                        <Route path="/app/sanctions" element={<Navigate to="/app/audit-interne" replace />} />
                        <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </React.Suspense>
                  </GlobalFiltersProvider>
                </BrowserRouter>
              </LanguageProvider>
            </PlanProvider>
          </ThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
