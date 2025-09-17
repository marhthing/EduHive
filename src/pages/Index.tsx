import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      navigate(session ? "/home" : "/auth", { replace: true });
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      navigate(session ? "/home" : "/auth", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return null;
};

export default Index;
