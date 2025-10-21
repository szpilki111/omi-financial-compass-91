
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import StyleProvider from "@/components/layout/StyleProvider";

// Pages
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";
import Index from "./pages/Index";
import KpirPage from "./pages/KPIR/KpirPage";
import Reports from "./pages/Reports";
import DataVisualization from "./pages/DataVisualization";
import DocumentsPage from "./pages/Documents/DocumentsPage";
import { AccountSearchPage } from "./pages/AccountSearch";
import { AdministrationPage } from "./pages/Administration";
import SettingsPage from "./pages/Settings/SettingsPage";

// Protected Route Component
import ProtectedRoute from "@/components/auth/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 60000, // 1 minute
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <StyleProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/dostep-zabroniony" element={<AccessDenied />} />
              
              {/* Routing index */}
              <Route path="/" element={<Index />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              {/* Documents route - dla wszystkich zalogowanych użytkowników */}
              <Route path="/dokumenty" element={
                <ProtectedRoute>
                  <DocumentsPage />
                </ProtectedRoute>
              } />
              
              {/* Account search route - dla wszystkich zalogowanych użytkowników */}
              <Route path="/wyszukaj-konta" element={
                <ProtectedRoute>
                  <AccountSearchPage />
                </ProtectedRoute>
              } />
              
              {/* KPIR routes - TYLKO dla ekonomów */}
              <Route path="/kpir" element={
                <ProtectedRoute requiredRole="ekonom">
                  <KpirPage />
                </ProtectedRoute>
              } />
              <Route path="/kpir/nowy" element={
                <ProtectedRoute requiredRole="ekonom">
                  <KpirPage />
                </ProtectedRoute>
              } />
              
              {/* Reports routes */}
              <Route path="/reports" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/reports/:reportId" element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } />
              
              {/* Data Visualization routes */}
              <Route path="/wizualizacja" element={
                <ProtectedRoute>
                  <DataVisualization />
                </ProtectedRoute>
              } />
              
              {/* Settings route */}
              <Route path="/settings" element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              } />
              
              {/* Administration routes - dla prowincjała i admina */}
              <Route path="/administracja" element={
                <ProtectedRoute requiredRole={["prowincjal", "admin"]}>
                  <AdministrationPage />
                </ProtectedRoute>
              } />
              
              {/* Not found */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </StyleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
