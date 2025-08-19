import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "./pages/home";
import Reservations from "./pages/reservations";
import Menu from "./pages/menu";
import Sports from "./pages/sports";
import Reviews from "./pages/reviews";
import Membership from "./pages/membership";
import Promotions from "./pages/promotions";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/reservations" component={Reservations} />
      <Route path="/menu" component={Menu} />
      <Route path="/sports" component={Sports} />
      <Route path="/reviews" component={Reviews} />
      <Route path="/membership" component={Membership} />
      <Route path="/promotions" component={Promotions} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
