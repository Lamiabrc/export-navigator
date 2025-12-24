import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Flows from "./pages/Flows";
import CircuitDetail from "./pages/CircuitDetail";
import Logistics from "./pages/Logistics";
import Guide from "./pages/Guide";
import Invoices from "./pages/Invoices";
import InvoiceVerification from "./pages/InvoiceVerification";
import Settings from "./pages/Settings";
import Simulator from "./pages/Simulator";
import MarginAnalysis from "./pages/MarginAnalysis";
import ReferenceLibrary from "./pages/ReferenceLibrary";
import ControlTower from "./pages/ControlTower";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Imports from "./pages/Imports";
import Home from "./pages/Home";
import Clients from "./pages/Clients";
import FlowManager from "./pages/FlowManager";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<Navigate to="/control-tower" replace />} />
            <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/control-tower" element={<ProtectedRoute><ControlTower /></ProtectedRoute>} />
            <Route path="/flows" element={<ProtectedRoute><Flows /></ProtectedRoute>} />
            <Route path="/flows/:id" element={<ProtectedRoute><CircuitDetail /></ProtectedRoute>} />
            <Route path="/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
            <Route path="/finance" element={<Navigate to="/margin-analysis" replace />} />
            <Route path="/guide" element={<ProtectedRoute><Guide /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/invoice-verification" element={<ProtectedRoute><InvoiceVerification /></ProtectedRoute>} />
            <Route path="/simulator" element={<ProtectedRoute><Simulator /></ProtectedRoute>} />
            <Route path="/export-dashboard" element={<Navigate to="/dashboard" replace />} />
            <Route path="/margin-analysis" element={<ProtectedRoute><MarginAnalysis /></ProtectedRoute>} />
            <Route path="/reference-library" element={<ProtectedRoute><ReferenceLibrary /></ProtectedRoute>} />
            <Route path="/imports" element={<ProtectedRoute><Imports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
            <Route path="/flow-manager" element={<ProtectedRoute><FlowManager /></ProtectedRoute>} />
            <Route path="/circuits" element={<Navigate to="/flows" replace />} />
            <Route path="/circuits/:id" element={<Navigate to="/flows/:id" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
