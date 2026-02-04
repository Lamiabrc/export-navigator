import * as React from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
import { LanguageChooser } from "@/components/LanguageChooser";

const Home = React.lazy(() => import("@/pages/Home"));
const ToolPage = React.lazy(() => import("@/pages/Tool"));
const ServicesPage = React.lazy(() => import("@/pages/Services"));
const AboutPage = React.lazy(() => import("@/pages/About"));
const Analyse = React.lazy(() => import("@/pages/Analyse"));
const ShareDecision = React.lazy(() => import("@/pages/ShareDecision"));
const Methodologie = React.lazy(() => import("@/pages/Methodologie"));
const Guide = React.lazy(() => import("@/pages/Guide"));

const WatchCenter = React.lazy(() => import("@/pages/WatchCenter"));
const WatchRegulatory = React.lazy(() => import("@/pages/WatchRegulatory"));
const WatchCommercial = React.lazy(() => import("@/pages/WatchCommercial"));

const InvoiceCheck = React.lazy(() => import("@/pages/InvoiceCheck"));
const Newsletter = React.lazy(() => import("@/pages/Newsletter"));
const Login = React.lazy(() => import("@/pages/Login"));
const Register = React.lazy(() => import("@/pages/Register"));
const ForgotPassword = React.lazy(() => import("@/pages/ForgotPassword"));
const SetPassword = React.lazy(() => import("@/pages/SetPassword"));

const CommandCenter = React.lazy(() => import("@/pages/CommandCenter"));
const Simulator = React.lazy(() => import("@/pages/Simulator"));

const Products = React.lazy(() => import("@/pages/Products"));
const Sales = React.lazy(() => import("@/pages/Sales"));
const InvoiceDetail = React.lazy(() => import("@/pages/InvoiceDetail"));

const Admin = React.lazy(() => import("@/pages/Admin"));
const Assistant = React.lazy(() => import("@/pages/Assistant"));
const Settings = React.lazy(() => import("@/pages/Settings"));
const NotFound = React.lazy(() => import("@/pages/NotFound"));
const Solutions = React.lazy(() => import("@/pages/Solutions"));
const Veille = React.lazy(() => import("@/pages/Veille"));
const Resources = React.lazy(() => import("@/pages/Resources"));
const Contact = React.lazy(() => import("@/pages/Contact"));
const InternalResources = React.lazy(() => import("@/pages/InternalResources"));
const ExportToFrance = React.lazy(() => import("@/pages/ExportToFrance"));

const Pricing = React.lazy(() => import("@/pages/Pricing"));
const HistoryPage = React.lazy(() => import("@/pages/History"));
const ImportCheckInvoice = React.lazy(() => import("@/pages/ImportCheckInvoice"));
const ExportCostingPage = React.lazy(() => import("@/pages/ExportCosting"));
const VipRentability = React.lazy(() => import("@/pages/VipRentability"));

const Legal = React.lazy(() => import("@/pages/Legal"));

const queryClient = new QueryClient();
const LazyFallback = () => (
  <div className="p-6 text-sm text-muted-foreground">Chargement…</div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {/* ✅ clé de thème projet (évite collision avec ancien) */}
          <ThemeProvider defaultTheme="light" storageKey="mpl-ui-theme">
            <Toaster />
            <Sonner />

            <PlanProvider>
              {/* ✅ si tu as appliqué le LanguageContext “no storage” */}
              <LanguageProvider persist="none">
                <CookieConsent />
                <BrowserRouter>
                  <LanguageChooser />
                  <CompanyProfileGuard />
                  <GlobalFiltersProvider>
                    <React.Suspense fallback={<LazyFallback />}>
                      <Routes>
                      {/* ===================== Marketing / Public ===================== */}
                      <Route path="/" element={<Home />} />
                      <Route path="/tool" element={<ToolPage />} />
                      <Route path="/services" element={<ServicesPage />} />

                      {/* ✅ EN/legacy marketing (Watch supprimée => redirect) */}
                      <Route path="/watch" element={<Navigate to="/veille" replace />} />

                      {/* ✅ FR canonique */}
                      <Route path="/veille" element={<Veille />} />

                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/pricing" element={<Pricing />} />

                      {/* ✅ pages publiques */}
                      <Route path="/analyse" element={<Analyse />} />
                      <Route path="/share/:id" element={<ShareDecision />} />
                      <Route path="/methodologie" element={<Methodologie />} />

                      {/* ✅ FIX: /guides existe (redirige vers un guide par défaut) */}
                      <Route path="/guides" element={<Navigate to="/guides/incoterms-ddp" replace />} />
                      <Route path="/guides/:slug" element={<Guide />} />

                      <Route path="/solutions" element={<Solutions />} />
                      <Route path="/resources" element={<Resources />} />

                      {/* ✅ Tarifs supprimée => redirect vers pricing */}
                      <Route path="/tarifs" element={<Navigate to="/pricing" replace />} />

                      <Route path="/contact" element={<Contact />} />
                      <Route path="/export-to-france" element={<ExportToFrance />} />
                      <Route path="/newsletter" element={<Newsletter />} />

                      {/* ✅ outil gratuit (pas besoin de login) */}
                      <Route path="/export/costing" element={<ExportCostingPage />} />

                      {/* ===================== PRO/VIP (✅ derrière login) ===================== */}
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

                      {/* ===================== App (privé) ===================== */}
                      <Route
                        path="/app/command-center"
                        element={
                          <ProtectedRoute>
                            <CommandCenter />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="/app" element={<Navigate to="/app/command-center" replace />} />

                      <Route
                        path="/app/explore"
                        element={
                          <ProtectedRoute>
                            <Sales />
                          </ProtectedRoute>
                        }
                      />

                      <Route
                        path="/app/invoices/:invoiceNumber"
                        element={
                          <ProtectedRoute>
                            <InvoiceDetail />
                          </ProtectedRoute>
                        }
                      />

                      {/* ✅ Taxes OM supprimée => on garde l'URL mais redirection vers Command Center */}
                      <Route
                        path="/app/droits-taxes"
                        element={
                          <ProtectedRoute>
                            <Navigate to="/app/command-center" replace />
                          </ProtectedRoute>
                        }
                      />
                      {/* ✅ Backward compatibility */}
                      <Route path="/app/taxes-om" element={<Navigate to="/app/droits-taxes" replace />} />

                      <Route
                        path="/app/simulator"
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

                      {/* ✅ Canonique : secteurs (remplace concurrence) */}
                      <Route
                        path="/app/centre-veille/secteurs"
                        element={
                          <ProtectedRoute>
                            <WatchCommercial />
                          </ProtectedRoute>
                        }
                      />
                      {/* ✅ Backward compatibility */}
                      <Route
                        path="/app/centre-veille/concurrence"
                        element={<Navigate to="/app/centre-veille/secteurs" replace />}
                      />

                      <Route
                        path="/app/produits"
                        element={
                          <ProtectedRoute>
                            <Products />
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
                        path="/app/invoice-check"
                        element={
                          <ProtectedRoute>
                            <InvoiceCheck />
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
                      <Route path="/welcome" element={<Navigate to="/solutions" replace />} />
                      <Route path="/ressources" element={<Navigate to="/resources" replace />} />

                      <Route path="/hub" element={<Navigate to="/app/command-center" replace />} />
                      <Route path="/command-center" element={<Navigate to="/app/command-center" replace />} />
                      <Route path="/dashboard" element={<Navigate to="/app/command-center" replace />} />
                      <Route path="/explore" element={<Navigate to="/app/explore" replace />} />
                      <Route path="/sales" element={<Navigate to="/app/explore" replace />} />

                      {/* ✅ anciens chemins taxes/om => droits-taxes */}
                      <Route path="/taxes-om" element={<Navigate to="/app/droits-taxes" replace />} />

                      <Route path="/simulator" element={<Navigate to="/app/simulator" replace />} />
                      <Route path="/watch/regulatory" element={<Navigate to="/app/centre-veille/reglementation" replace />} />

                      {/* ✅ Tous les anciens chemins concurrence -> secteurs */}
                      <Route path="/watch/commercial" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                      <Route path="/watch/competitive" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                      <Route path="/competition" element={<Navigate to="/app/centre-veille/secteurs" replace />} />
                      <Route path="/concurrence" element={<Navigate to="/app/centre-veille/secteurs" replace />} />

                      <Route path="/products" element={<Navigate to="/app/produits" replace />} />
                      <Route path="/invoice-check" element={<Navigate to="/app/invoice-check" replace />} />
                      <Route path="/assistant" element={<Navigate to="/app/assistant" replace />} />
                      <Route path="/admin" element={<Navigate to="/app/admin" replace />} />
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
