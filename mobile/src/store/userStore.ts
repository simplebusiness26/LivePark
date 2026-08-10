import { create } from 'zustand';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface UserState {
  session: Session | null;
  user: User | null;
  role: 'driver' | 'host' | 'admin' | null;
  setSession: (session: Session | null) => void;
  fetchProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  session: null,
  user: null,
  role: null,
  setSession: (session) => {
    set({ session, user: session?.user || null });
    if (session) {
      useUserStore.getState().fetchProfile();
    } else {
      set({ role: null });
    }
  },
  fetchProfile: async () => {
    const user = useUserStore.getState().user;
    if (user) {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();
      if (data && !error) {
        set({ role: data.role as 'driver' | 'host' | 'admin' });
      }
    }
  },
  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, role: null });
  },
}));
