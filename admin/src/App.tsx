import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Dashboard } from './pages/Dashboard';
import { Auth } from './pages/Auth';
import { Session } from '@supabase/supabase-js';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdminRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkAdminRole(session.user.id);
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    });
  }, []);

  const checkAdminRole = async (userId: string) => {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    if (data && data.role === 'admin') {
      setIsAdmin(true);
    } else {
      setIsAdmin(false);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <Auth />;
  }

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
        <h2>Unauthorized Access</h2>
        <p>You do not have administrative privileges.</p>
        <button onClick={handleLogout} style={{ padding: '10px 20px', cursor: 'pointer' }}>Logout</button>
      </div>
    );
  }

  return (
    <div className="App">
      <div style={{ padding: '10px 40px', background: '#111827', color: 'white', display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid white', color: 'white', padding: '5px 15px', borderRadius: '4px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
      <Dashboard />
    </div>
  );
}

export default App;
