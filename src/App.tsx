import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";

// Public
import Welcome from "@/pages/Welcome";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import SetPassword from "@/pages/SetPassword";

// Protected - Core
import Home from "@/pages/Home";
import Hub from "@/pages/Hub";
import CommandCenter from "@/pages/CommandCenter";
import Assistant from "@/pages/Assistant";
import Simulator from "@/pages/Simulator";
import InvoiceVerification from "@/pages/InvoiceVerification";
import Invoices from "@/pages/Invoices";

// Data
import Clients from "@/pages/Clients";
import Products from "@/pages/Products";

// Ops / Process
import Flows from "@/pages/Flows";
import CircuitDetails from "@/pages/CircuitDetails";
import Logistics from "@/pages/Logistics";

// Pricing
import Finance from "@/pages/Finance";
import MarginAnalysis from "@/pages/MarginAnalysis";

// Watch
import WatchCommercial from "@/pages/WatchCommercial";
import WatchRegulatory from "@/pages/WatchRegulatory";

// Knowledge
import Guide from "@/pages/Guide";
import ReferenceLibrary from "@/pages/ReferenceLibrary";
import DromPlaybook from "@/pages/DromPlaybook";

// Admin / Settings
import Admin from "@/pages/Admin";
import Settings from "@/pages/Settings";

// Misc
import Auth from "@/pages/Auth";
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
              <Routes>
                {/* Root */}
                <Route path="/" element={<Navigate to="/welcome" replace />} />

                {/* Public */}
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/set-password" element={<SetPassword />} />

                {/* Optional internal auth page */}
                <Route path="/auth" element={<Auth />} />

                {/* Protected */}
                <Route
                  path="/home"
                  element={
                    <ProtectedRoute>
                      <Home />
                    </ProtectedRoute>
                  }
                />

                {/* Alias: Home => Hub (si tu veux forcer Hub) */}
                <Route path="/home/redirect" element={<Navigate to="/hub" replace />} />

                <Route
                  path="/hub"
                  element={
                    <ProtectedRoute>
                      <Hub />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/command-center"
                  element={
                    <ProtectedRoute>
                      <CommandCenter />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/assistant"
                  element={
                    <ProtectedRoute>
                      <Assistant />
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

                <Route
                  path="/verifier"
                  element={
                    <ProtectedRoute>
                      <InvoiceVerification />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/invoices"
                  element={
                    <ProtectedRoute>
                      <Invoices />
                    </ProtectedRoute>
                  }
                />

                {/* Data */}
                <Route
                  path="/clients"
                  element={
                    <ProtectedRoute>
                      <Clients />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/products"
                  element={
                    <ProtectedRoute>
                      <Products />
                    </ProtectedRoute>
                  }
                />

                {/* Ops / Process */}
                <Route
                  path="/flows"
                  element={
                    <ProtectedRoute>
                      <Flows />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/flows/:id"
                  element={
                    <ProtectedRoute>
                      <CircuitDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/logistics"
                  element={
                    <ProtectedRoute>
                      <Logistics />
                    </ProtectedRoute>
                  }
                />

                {/* Pricing */}
                <Route
                  path="/finance"
                  element={
                    <ProtectedRoute>
                      <Finance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/margin-analysis"
                  element={
                    <ProtectedRoute>
                      <MarginAnalysis />
                    </ProtectedRoute>
                  }
                />

                {/* Watch */}
                <Route
                  path="/watch/commercial"
                  element={
                    <ProtectedRoute>
                      <WatchCommercial />
                    </ProtectedRoute>
                  }
                />
                <Route path="/watch/competitive" element={<Navigate to="/watch/commercial" replace />} />

                <Route
                  path="/watch/regulatory"
                  element={
                    <ProtectedRoute>
                      <WatchRegulatory />
                    </ProtectedRoute>
                  }
                />

                {/* Knowledge */}
                <Route
                  path="/guide"
                  element={
                    <ProtectedRoute>
                      <Guide />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reference-library"
                  element={
                    <ProtectedRoute>
                      <ReferenceLibrary />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/drom-playbook"
                  element={
                    <ProtectedRoute>
                      <DromPlaybook />
                    </ProtectedRoute>
                  }
                />

                {/* Admin / Settings */}
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <Settings />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute>
                      <Admin />
                    </ProtectedRoute>
                  }
                />

                {/* 404 */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
