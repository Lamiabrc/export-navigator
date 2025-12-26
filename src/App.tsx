import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Home from "./pages/Home";
import AuthPage from "./pages/Auth";
import NotFound from "./pages/NotFound";

import Flows from "./pages/Flows";
import CircuitDetail from "./pages/CircuitDetail";
import Logistics from "./pages/Logistics";
import Finance from "./pages/Finance";
import Guide from "./pages/Guide";
import Invoices from "./pages/Invoices";
import InvoiceVerification from "./pages/InvoiceVerification";
import Settings from "./pages/Settings";
import Simulator from "./pages/Simulator";
import MarginAnalysis from "./pages/MarginAnalysis";
import ReferenceLibrary from "./pages/ReferenceLibrary";
import Imports from "./pages/Imports";
import Clients from "./pages/Clients";

// ✅ Hub fusionné
import CommandCenter from "./pages/CommandCenter";

// Legacy (on garde pour ne rien perdre)
import Dashboard from "./pages/Dashboard";
import ControlTower from "./pages/ControlTower";
import StrategyHub from "./pages/StrategyHub";
import CompetitiveIntel from "./pages/CompetitiveIntel";
import ScenarioLab from "./pages/ScenarioLab";
import PricingPositioning from "./pages/PricingPositioning";

const queryClient = new QueryClient();

function CircuitsLegacyRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/flows/${id}` : "/flows"} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Default */}
            <Route path="/" element={<Navigate to="/control-tower" replace />} />

            {/* Protected */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <Home />
                </ProtectedRoute>
              }
            />

            {/* ✅ HUB UNIQUE */}
            <Route
              path="/control-tower"
              element={
                <ProtectedRoute>
                  <CommandCenter />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Navigate to="/control-tower" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/strategy"
              element={
                <ProtectedRoute>
                  <Navigate to="/control-tower" replace />
                </ProtectedRoute>
              }
            />

            {/* ✅ DROM Playbook intégré au Guide */}
            <Route
              path="/drom-playbook"
              element={
                <ProtectedRoute>
                  <Navigate to="/guide?tab=drom" replace />
                </ProtectedRoute>
              }
            />

            {/* Pages principales */}
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
                  <CircuitDetail />
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
            <Route
              path="/finance"
              element={
                <ProtectedRoute>
                  <Finance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/guide"
              element={
                <ProtectedRoute>
                  <Guide />
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
            <Route
              path="/invoice-verification"
              element={
                <ProtectedRoute>
                  <InvoiceVerification />
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
              path="/margin-analysis"
              element={
                <ProtectedRoute>
                  <MarginAnalysis />
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
              path="/imports"
              element={
                <ProtectedRoute>
                  <Imports />
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
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />

            {/* Legacy pages (si tu veux encore y accéder ponctuellement) */}
            <Route
              path="/dashboard-legacy"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/control-tower-legacy"
              element={
                <ProtectedRoute>
                  <ControlTower />
                </ProtectedRoute>
              }
            />
            <Route
              path="/strategy-hub"
              element={
                <ProtectedRoute>
                  <StrategyHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pricing-positioning"
              element={
                <ProtectedRoute>
                  <PricingPositioning />
                </ProtectedRoute>
              }
            />
            <Route
              path="/competitive"
              element={
                <ProtectedRoute>
                  <CompetitiveIntel />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scenario-lab"
              element={
                <ProtectedRoute>
                  <ScenarioLab />
                </ProtectedRoute>
              }
            />

            {/* Legacy redirects */}
            <Route
              path="/export-dashboard"
              element={
                <ProtectedRoute>
                  <Navigate to="/control-tower" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/flow-manager"
              element={
                <ProtectedRoute>
                  <Navigate to="/flows" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/circuits"
              element={
                <ProtectedRoute>
                  <Navigate to="/flows" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/circuits/:id"
              element={
                <ProtectedRoute>
                  <CircuitsLegacyRedirect />
                </ProtectedRoute>
              }
            />

            {/* 404 guarded */}
            <Route
              path="*"
              element={
                <ProtectedRoute>
                  <NotFound />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
