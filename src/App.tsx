import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";

import LeadMagnet from "@/pages/LeadMagnet";
import Analyse from "@/pages/Analyse";
import ShareDecision from "@/pages/ShareDecision";
import Methodologie from "@/pages/Methodologie";
import Guide from "@/pages/Guide";
import WatchCenter from "@/pages/WatchCenter";
import WatchRegulatory from "@/pages/WatchRegulatory";
import WatchCommercial from "@/pages/WatchCommercial";
import InvoiceCheck from "@/pages/InvoiceCheck";
import Newsletter from "@/pages/Newsletter";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import SetPassword from "@/pages/SetPassword";

import CommandCenter from "@/pages/CommandCenter";
import Simulator from "@/pages/Simulator";

import Products from "@/pages/Products";

import Sales from "@/pages/Sales";
import TaxesOM from "@/pages/TaxesOM";
import InvoiceDetail from "@/pages/InvoiceDetail";

import Admin from "@/pages/Admin";
import Assistant from "@/pages/Assistant";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Solutions from "@/pages/Solutions";
import Veille from "@/pages/Veille";
import Resources from "@/pages/Resources";
import Tarifs from "@/pages/Tarifs";
import Contact from "@/pages/Contact";
import InternalResources from "@/pages/InternalResources";
import ExportToFrance from "@/pages/ExportToFrance";

// ✅ NOUVEAU
import Legal from "@/pages/Legal";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <ThemeProvider defaultTheme="light" storageKey="export-ui-theme">
            <Toaster />
            <Sonner />

            <BrowserRouter>
              <GlobalFiltersProvider>
                <Routes>
                  {/* Core */}
                  <Route path="/" element={<LeadMagnet />} />
                  <Route path="/analyse" element={<Analyse />} />
                  <Route path="/share/:id" element={<ShareDecision />} />
                  <Route path="/methodologie" element={<Methodologie />} />
                  <Route path="/guides/:slug" element={<Guide />} />

                  {/* Public */}
                  <Route path="/solutions" element={<Solutions />} />
                  <Route path="/veille" element={<Veille />} />
                  <Route path="/resources" element={<Resources />} />
                  <Route path="/tarifs" element={<Tarifs />} />
                  <Route path="/contact" element={<Contact />} />
                  <Route path="/export-to-france" element={<ExportToFrance />} />
                  <Route path="/newsletter" element={<Newsletter />} />

                  {/* Aliases FR + legacy marketing */}
                  <Route path="/services" element={<Navigate to="/solutions" replace />} />
                  <Route path="/welcome" element={<Navigate to="/solutions" replace />} />
                  <Route path="/ressources" element={<Navigate to="/resources" replace />} />

                  {/* Legal (✅ manquant important) */}
                  <Route path="/legal/:slug" element={<Legal />} />
                  <Route path="/mentions-legales" element={<Navigate to="/legal/mentions-legales" replace />} />
                  <Route path="/confidentialite" element={<Navigate to="/legal/confidentialite" replace />} />
                  <Route path="/cookies" element={<Navigate to="/legal/cookies" replace />} />
                  <Route path="/cgu" element={<Navigate to="/legal/cgu" replace />} />
                  <Route path="/cgv" element={<Navigate to="/legal/cgv" replace />} />

                  {/* Auth */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/set-password" element={<SetPassword />} />

                  {/* App */}
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
                  <Route
                    path="/app/taxes-om"
                    element={
                      <ProtectedRoute>
                        <TaxesOM />
                      </ProtectedRoute>
                    }
                  />
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
                  <Route path="/app/centre-veille/concurrence" element={<Navigate to="/app/centre-veille/secteurs" replace />} />

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

                  {/* Legacy aliases */}
                  <Route path="/hub" element={<Navigate to="/app/command-center" replace />} />
                  <Route path="/command-center" element={<Navigate to="/app/command-center" replace />} />
                  <Route path="/dashboard" element={<Navigate to="/app/command-center" replace />} />
                  <Route path="/explore" element={<Navigate to="/app/explore" replace />} />
                  <Route path="/sales" element={<Navigate to="/app/explore" replace />} />
                  <Route path="/taxes-om" element={<Navigate to="/app/taxes-om" replace />} />
                  <Route path="/simulator" element={<Navigate to="/app/simulator" replace />} />
                  <Route path="/watch" element={<Navigate to="/app/centre-veille" replace />} />
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
              </GlobalFiltersProvider>
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
