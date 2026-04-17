import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotFound from "@/pages/not-found";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Diary from "@/pages/Diary";
import Chat from "@/pages/Chat";
import Mood from "@/pages/Mood";
import MentalPeace from "@/pages/MentalPeace";
import About from "@/pages/About";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (location === "/login" || location === "/register") {
    return <>{children}</>;
  }
  if (!user) {
    return <Redirect to="/login" />;
  }
  return <>{children}</>;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/">
        <AppLayout>
          <Home />
        </AppLayout>
      </Route>
      <Route path="/diary">
        <AppLayout>
          <Diary />
        </AppLayout>
      </Route>
      <Route path="/chat">
        <AppLayout>
          <Chat />
        </AppLayout>
      </Route>
      <Route path="/mood">
        <AppLayout>
          <Mood />
        </AppLayout>
      </Route>
      <Route path="/mental-peace">
        <AppLayout>
          <MentalPeace />
        </AppLayout>
      </Route>
      <Route path="/about">
        <AppLayout>
          <About />
        </AppLayout>
      </Route>
      <Route path="/settings">
        <AppLayout>
          <Settings />
        </AppLayout>
      </Route>
      <Route path="/:rest*">
        <AppLayout>
          <NotFound />
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SettingsProvider>
            <Toaster />
            <AuthGuard>
              <Router />
            </AuthGuard>
          </SettingsProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
