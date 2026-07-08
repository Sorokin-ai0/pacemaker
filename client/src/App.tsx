import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppShell, Splash } from "@/components/layout/AppShell";
import { Toaster } from "@/components/ui/toaster";
import { useAuth } from "@/context/auth";
import { AuthProvider } from "@/context/AuthProvider";
import { SettingsProvider } from "@/context/SettingsProvider";
import { ThemeProvider } from "@/context/ThemeProvider";
import { CalendarPage } from "@/pages/CalendarPage";
import { CoachPage } from "@/pages/CoachPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { OnboardingPage } from "@/pages/OnboardingPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { RunLogPage } from "@/pages/RunLogPage";
import { SettingsPage } from "@/pages/SettingsPage";

/** Public pages redirect signed-in users into the app. */
function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (user) return <Navigate to={user.hasProfile ? "/dashboard" : "/onboarding"} replace />;
  return children;
}

/** Everything below requires a session. */
function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** App pages additionally require a training profile. */
function RequireProfile() {
  const { user } = useAuth();
  if (user && !user.hasProfile) return <Navigate to="/onboarding" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicOnly>
                    <LoginPage />
                  </PublicOnly>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicOnly>
                    <RegisterPage />
                  </PublicOnly>
                }
              />

              <Route element={<RequireAuth />}>
                {/* Onboarding is reachable with or without a profile (re-onboarding
                  recovers a missing plan); users without one are forced here. */}
                <Route path="/onboarding" element={<OnboardingPage />} />

                <Route element={<RequireProfile />}>
                  <Route element={<AppShell />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/log" element={<RunLogPage />} />
                    <Route path="/coach" element={<CoachPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </AuthProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
}
