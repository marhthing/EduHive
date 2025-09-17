import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        navigate("/home", { replace: true });
      } else {
        navigate("/auth", { replace: true });
      }
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <img src="/logo-animated.svg" alt="Loading" className="h-28 w-28 mx-auto mb-4" />
        <p className="text-muted-foreground animate-pulse">Welcome to EduHive</p>
      </div>
    </div>
  );
};

export default Index;