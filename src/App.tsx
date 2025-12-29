import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Welcome from "@/pages/Welcome";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import SetPassword from "@/pages/SetPassword";

import Hub from "@/pages/Hub";
import Simulator from "@/pages/Simulator";
import InvoiceVerification from "@/pages/InvoiceVerification";
import WatchCommercial from "@/pages/WatchCommercial";
import WatchRegulatory from "@/pages/WatchRegulatory";
import Admin from "@/pages/Admin";
import Assistant from "@/pages/Assistant";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          {/* UI global */}
          <Toaster />
          <Sonner />

          {/* Router */}
          <BrowserRouter>
            <Routes>
              {/* Root */}
              <Route path="/" element={<Navigate to="/welcome" replace />} />

              {/* Public */}
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />

              {/* Public: password flow (reste dans ton outil) */}
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/set-password" element={<SetPassword />} />

              {/* Protected */}
              <Route
                path="/hub"
                element={
                  <ProtectedRoute>
                    <Hub />
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
                path="/watch/commercial"
                element={
                  <ProtectedRoute>
                    <WatchCommercial />
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
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <Admin />
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

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
