import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DimoAuthProvider, initializeDimoSDK } from "@dimo-network/login-with-dimo";
import { ThemeProvider } from "@/components/theme-provider";
import AppNavigation from "@/components/navigation";
import NotFound from "@/pages/not-found";
import GpsVisualizer from "@/pages/gps-visualizer";
import SharedVehicles from "@/pages/shared-vehicles";

// Initialize DIMO SDK
initializeDimoSDK({
  clientId: import.meta.env.VITE_DIMO_CLIENT_ID,
  redirectUri: import.meta.env.VITE_DIMO_REDIRECT_URI,
  environment: "production"
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={GpsVisualizer} />
      <Route path="/shared-vehicles" component={SharedVehicles} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DimoAuthProvider>
        <ThemeProvider>
          <TooltipProvider>
            <AppNavigation />
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </DimoAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
