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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  const checkDeactivationStatus = async (userId: string) => {
    try {
      console.log('Checking deactivation status for user:', userId);
      
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('is_deactivated, scheduled_deletion_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error checking deactivation status:', error);
        return false;
      }

      // If no profile found, this means the user doesn't have a proper profile
      if (!profileData) {
        console.log('No profile found for user - signing out incomplete account');
        await supabase.auth.signOut();
        throw new Error('User profile not found - account incomplete');
      }

      if (profileData.is_deactivated) {
        const deletionDate = new Date(profileData.scheduled_deletion_at);
        const now = new Date();
        
        if (deletionDate <= now) {
          // Account is past deletion date - sign out
          console.log('Account past deletion date, signing out');
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
    // Clear any potentially stuck state first
    const clearStuckState = async () => {
      try {
        // Check if there's a session but it might be invalid
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.log('Session error detected, signing out:', error);
          await supabase.auth.signOut();
        }
      } catch (error) {
        console.log('Error checking session, signing out:', error);
        await supabase.auth.signOut();
      }
    };

    // Get initial session
    const getInitialSession = async () => {
      await clearStuckState();
      try {
        console.log('Getting initial session...');
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session:', session);
        
        if (session?.user) {
          console.log('User found, checking deactivation status...');
          const deactivated = await checkDeactivationStatus(session.user.id);
          console.log('Deactivation status:', deactivated);
          setSession(session);
          setUser(session.user);
          setIsDeactivated(deactivated);
        } else {
          console.log('No user found, clearing auth state');
          setSession(null);
          setUser(null);
          setIsDeactivated(false);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        setSession(null);
        setUser(null);
        setIsDeactivated(false);
      } finally {
        console.log('Setting loading to false');
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };

    getInitialSession();

    // Listen for auth changes - only check deactivation on SIGNED_IN event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user && event === 'SIGNED_IN') {
          // Only check deactivation on fresh sign-in, not on route changes
          console.log('New sign-in detected, checking deactivation status...');
          const deactivated = await checkDeactivationStatus(session.user.id);
          console.log('Sign-in deactivation status:', deactivated);
          setIsDeactivated(deactivated);

          // Store username in localStorage for easy access
          if (session.user.user_metadata?.username) {
            localStorage.setItem(`username_${session.user.id}`, session.user.user_metadata.username);
          }

          // Sync Google avatar to profile if available and not already set
          if (session.user.user_metadata?.avatar_url) {
            setTimeout(async () => {
              try {
                const { data: profileData, error: profileError } = await supabase
                  .from('profiles')
                  .select('profile_pic')
                  .eq('user_id', session.user.id)
                  .single();

                if (profileError) {
                  console.log('Profile not ready for avatar sync yet');
                  return;
                }

                if (!profileData?.profile_pic || profileData.profile_pic !== session.user.user_metadata.avatar_url) {
                  const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ profile_pic: session.user.user_metadata.avatar_url })
                    .eq('user_id', session.user.id);

                  if (!updateError) {
                    console.log('Synced Google avatar to profile');
                  }
                }
              } catch (error) {
                console.log('Avatar sync skipped');
              }
            }, 1000);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          setIsDeactivated(false);
          
          // Clear username from localStorage
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('username_')) {
              localStorage.removeItem(key);
            }
          });
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