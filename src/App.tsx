import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "@/components/theme-provider";

import Welcome from "@/pages/Welcome";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import SetPassword from "@/pages/SetPassword";

import Hub from "@/pages/Hub";
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
              <Routes>
                <Route path="/" element={<Navigate to="/welcome" replace />} />

                {/* Public */}
                <Route path="/welcome" element={<Welcome />} />
                <Route path="/login" element={<Login />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/set-password" element={<SetPassword />} />

                {/* Core */}
                <Route path="/hub" element={<ProtectedRoute><Hub /></ProtectedRoute>} />
                <Route path="/command-center" element={<ProtectedRoute><CommandCenter /></ProtectedRoute>} />
                <Route path="/simulator" element={<ProtectedRoute><Simulator /></ProtectedRoute>} />
                <Route path="/assistant" element={<ProtectedRoute><Assistant /></ProtectedRoute>} />

                {/* Contrôle documents (secondaire) */}
                <Route path="/verifier" element={<ProtectedRoute><InvoiceVerification /></ProtectedRoute>} />
                {/* Compat si tu avais un lien historique */}
                <Route path="/invoice-verification" element={<Navigate to="/verifier" replace />} />

                {/* Data */}
                <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />

                <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
                <Route path="/costs" element={<ProtectedRoute><Costs /></ProtectedRoute>} />
                <Route path="/taxes-om" element={<ProtectedRoute><TaxesOM /></ProtectedRoute>} />

                {/* Si tu avais /invoices avant, on le recycle => ventes */}
                <Route path="/invoices" element={<Navigate to="/sales" replace />} />

                {/* Watch */}
                <Route path="/watch/commercial" element={<ProtectedRoute><WatchCommercial /></ProtectedRoute>} />
                <Route path="/watch/competitive" element={<Navigate to="/watch/commercial" replace />} />
                <Route path="/watch/regulatory" element={<ProtectedRoute><WatchRegulatory /></ProtectedRoute>} />

                {/* Admin */}
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </ThemeProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
