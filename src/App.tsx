import { TwitterToastProvider } from "@/components/ui/twitter-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";

// Lazy load pages for better performance
const Index = lazy(() => import("./pages/Index"));
const Home = lazy(() => import("./pages/Home"));
const Auth = lazy(() => import("./pages/Auth"));
const Search = lazy(() => import("./pages/Search"));
const Bookmarks = lazy(() => import("./pages/Bookmarks"));
const Profile = lazy(() => import("./pages/Profile"));
const CreatePost = lazy(() => import("./pages/CreatePost"));
const EditPost = lazy(() => import("./pages/EditPost"));
const PostDetail = lazy(() => import("./pages/PostDetail"));
const Settings = lazy(() => import("./pages/Settings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const AccountReactivation = lazy(() => import("@/pages/AccountReactivation"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <TwitterToastProvider>
          <BrowserRouter>
            <Suspense fallback={
              <div className="min-h-screen flex items-center justify-center bg-background transition-opacity duration-150 ease-in">
                <div className="text-center animate-fadeIn">
                  <img src="/logo-animated.svg" alt="Loading" className="h-16 w-16 mx-auto mb-4" />
                  <p className="text-muted-foreground animate-pulse">Loading...</p>
                </div>
              </div>
            }>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/reactivate" element={<AccountReactivation />} />
                <Route path="/home" element={<ProtectedRoute><Layout><Home /></Layout></ProtectedRoute>} />
                <Route path="/search" element={<ProtectedRoute><Layout><Search /></Layout></ProtectedRoute>} />
                <Route path="/bookmarks" element={<ProtectedRoute><Layout><Bookmarks /></Layout></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
                <Route path="/profile/:username" element={<ProtectedRoute><Layout><Profile /></Layout></ProtectedRoute>} />
                <Route path="/post" element={<ProtectedRoute><Layout><CreatePost /></Layout></ProtectedRoute>} />
                <Route path="/post/edit/:postId" element={<ProtectedRoute><Layout><EditPost /></Layout></ProtectedRoute>} />
                <Route path="/post/:postId" element={<PostDetail />} />
                <Route path="/notifications" element={<ProtectedRoute><Layout><Notifications /></Layout></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><Layout><Settings /></Layout></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </TwitterToastProvider>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;