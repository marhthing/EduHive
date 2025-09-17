import { TwitterToastProvider } from "@/components/ui/twitter-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";
import Index from "./pages/Index";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import Search from "./pages/Search";
import Bookmarks from "./pages/Bookmarks";
import Profile from "./pages/Profile";
import CreatePost from "./pages/CreatePost";
import EditPost from "./pages/EditPost";
import PostDetail from "./pages/PostDetail";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Notifications from "@/pages/Notifications";
import AccountReactivation from "@/pages/AccountReactivation"; // Import the new page

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <TwitterToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/reactivate" element={<AccountReactivation />} /> {/* New route */}
              <Route path="/home" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><Layout><Search /></Layout></ProtectedRoute>} />
              <Route path="/bookmarks" element={<ProtectedRoute><Layout><Bookmarks /></Layout></ProtectedRoute>} />
              <Route path="/profile/:username" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
              <Route path="/post" element={<ProtectedRoute><Layout><CreatePost /></Layout></ProtectedRoute>} />
              <Route path="/post/edit/:postId" element={<ProtectedRoute><Layout><EditPost /></Layout></ProtectedRoute>} />
              <Route path="/post/:postId" element={<PostDetail />} />
              <Route path="/notifications" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </TwitterToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;