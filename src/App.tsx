import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Flows from "./pages/Flows";
import CircuitDetail from "./pages/CircuitDetail";
import Logistics from "./pages/Logistics";
import Finance from "./pages/Finance";
import Guide from "./pages/Guide";
import Invoices from "./pages/Invoices";
import Settings from "./pages/Settings";
import Simulator from "./pages/Simulator";
import ExportDashboard from "./pages/ExportDashboard";
import MarginAnalysis from "./pages/MarginAnalysis";
import ReferenceLibrary from "./pages/ReferenceLibrary";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import Imports from "./pages/Imports";
import Home from "./pages/Home";

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
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/flows" element={<ProtectedRoute><Flows /></ProtectedRoute>} />
            <Route path="/flows/:id" element={<ProtectedRoute><CircuitDetail /></ProtectedRoute>} />
            <Route path="/logistics" element={<ProtectedRoute><Logistics /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><Finance /></ProtectedRoute>} />
            <Route path="/guide" element={<ProtectedRoute><Guide /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/simulator" element={<ProtectedRoute><Simulator /></ProtectedRoute>} />
            <Route path="/export-dashboard" element={<ProtectedRoute><ExportDashboard /></ProtectedRoute>} />
            <Route path="/margin-analysis" element={<ProtectedRoute><MarginAnalysis /></ProtectedRoute>} />
            <Route path="/reference-library" element={<ProtectedRoute><ReferenceLibrary /></ProtectedRoute>} />
            <Route path="/imports" element={<ProtectedRoute><Imports /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
