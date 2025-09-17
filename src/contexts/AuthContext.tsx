import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
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

  const refreshUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
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
    let isMounted = true;

    console.log('Getting initial session...');

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;

      console.log('Initial session:', session);
      if (session?.user) {
        setUser(session.user);
        setSession(session);
        console.log('User found:', session.user.email);
      } else {
        setUser(null);
        setSession(null);
        console.log('No user found, clearing auth state');
      }
      setLoading(false);
      console.log('Setting loading to false');
    }).catch((error) => {
      console.error('Error getting session:', error);
      if (isMounted) {
        setUser(null);
        setSession(null);
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;

        console.log('Auth state change:', event, session);

        if (session?.user) {
          setUser(session.user);
          setSession(session);
        } else {
          setUser(null);
          setSession(null);
        }
        setLoading(false);
      }
    );

    // Safety timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isMounted && loading) {
        console.log('Auth context timeout reached, setting loading to false');
        setLoading(false);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const value = {
    user,
    session,
    loading,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};