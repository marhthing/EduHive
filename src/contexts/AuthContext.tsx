import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDeactivated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeactivated, setIsDeactivated] = useState(false);

  const checkDeactivationStatus = async (userId: string) => {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('is_deactivated, scheduled_deletion_at')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error checking deactivation status:', error);
        return false;
      }

      if (profileData?.is_deactivated) {
        const deletionDate = new Date(profileData.scheduled_deletion_at);
        const now = new Date();
        
        if (deletionDate <= now) {
          // Account is past deletion date - sign out
          await supabase.auth.signOut();
          return false;
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking deactivation status:', error);
      return false;
    }
  };

  const refreshUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        const deactivated = await checkDeactivationStatus(user.id);
        setIsDeactivated(deactivated);
      } else {
        setIsDeactivated(false);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
      setIsDeactivated(false);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const deactivated = await checkDeactivationStatus(session.user.id);
          setIsDeactivated(deactivated);
        } else {
          setIsDeactivated(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          const deactivated = await checkDeactivationStatus(session.user.id);
          setIsDeactivated(deactivated);
        } else {
          setIsDeactivated(false);
        }
        
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    user,
    session,
    loading,
    isDeactivated,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};