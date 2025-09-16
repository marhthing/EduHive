import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<Layout><Home /></Layout>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/search" element={<Layout><div className="p-8 text-center">Search page coming soon...</div></Layout>} />
            <Route path="/bookmarks" element={<Layout><div className="p-8 text-center">Bookmarks page coming soon...</div></Layout>} />
            <Route path="/profile" element={<Layout><div className="p-8 text-center">Profile page coming soon...</div></Layout>} />
            <Route path="/post" element={<Layout><div className="p-8 text-center">Create post page coming soon...</div></Layout>} />
            <Route path="/settings" element={<Layout><div className="p-8 text-center">Settings page coming soon...</div></Layout>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
