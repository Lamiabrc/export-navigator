import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { GlobalFiltersProvider } from "@/contexts/GlobalFiltersContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";

import Welcome from "@/pages/Welcome";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import SetPassword from "@/pages/SetPassword";

import CommandCenter from "@/pages/CommandCenter";
import Simulator from "@/pages/Simulator";
import InvoiceVerification from "@/pages/InvoiceVerification";

import Clients from "@/pages/Clients";
import Products from "@/pages/Products";

import Sales from "@/pages/Sales";
import Costs from "@/pages/Costs";
import TaxesOM from "@/pages/TaxesOM";

import WatchCommercial from "@/pages/WatchCommercial";
import WatchRegulatory from "@/pages/WatchRegulatory";

import ControlTower from "@/pages/ControlTower";

import Admin from "@/pages/Admin";
import Assistant from "@/pages/Assistant";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

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
                  <Route path="/" element={<Navigate to="/welcome" replace />} />

                  {/* Alias legacy / bookmarks */}
                  <Route path="/hub" element={<Navigate to="/control-tower" replace />} />

                  {/* Public */}
                  <Route path="/welcome" element={<Welcome />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/set-password" element={<SetPassword />} />

                  {/* Pilotage */}
                  <Route
                    path="/control-tower"
                    element={
                      <ProtectedRoute>
                        <ControlTower />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/dashboard" element={<Navigate to="/control-tower" replace />} />
                  <Route
                    path="/command-center"
                    element={
                      <ProtectedRoute>
                        <CommandCenter />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/explore"
                    element={
                      <ProtectedRoute>
                        <Sales />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/sales" element={<Navigate to="/explore" replace />} />

                  {/* Costs & pricing */}
                  <Route
                    path="/costs"
                    element={
                      <ProtectedRoute>
                        <Costs />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/taxes-om"
                    element={
                      <ProtectedRoute>
                        <TaxesOM />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/simulator"
                    element={
                      <ProtectedRoute>
                        <Simulator />
                      </ProtectedRoute>
                    }
                  />

                  {/* Concurrence */}
                  <Route
                    path="/concurrence"
                    element={
                      <ProtectedRoute>
                        <WatchCommercial />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/watch/commercial" element={<Navigate to="/concurrence" replace />} />
                  <Route path="/watch/competitive" element={<Navigate to="/concurrence" replace />} />
                  <Route path="/competition" element={<Navigate to="/concurrence" replace />} />

                  {/* Reference & veille */}
                  <Route
                    path="/products"
                    element={
                      <ProtectedRoute>
                        <Products />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/clients"
                    element={
                      <ProtectedRoute>
                        <Clients />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/watch/regulatory"
                    element={
                      <ProtectedRoute>
                        <WatchRegulatory />
                      </ProtectedRoute>
                    }
                  />

                  {/* IA */}
                  <Route
                    path="/assistant"
                    element={
                      <ProtectedRoute>
                        <Assistant />
                      </ProtectedRoute>
                    }
                  />

                  {/* Controle documents (secondaire) */}
                  <Route
                    path="/verifier"
                    element={
                      <ProtectedRoute>
                        <InvoiceVerification />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/invoice-verification" element={<Navigate to="/verifier" replace />} />

                  {/* Admin */}
                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute>
                        <Admin />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute>
                        <Settings />
                      </ProtectedRoute>
                    }
                  />

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
