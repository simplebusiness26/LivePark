import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import './Dashboard.css';

interface PendingSpace {
  id: string;
  title: string;
  address_line1: string;
  city: string;
  host_id: string;
}

export const Dashboard: React.FC = () => {
  const [spaces, setSpaces] = useState<PendingSpace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingSpaces();
  }, []);

  const fetchPendingSpaces = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('parking_spaces')
      .select('id, title, address_line1, city, host_id')
      .eq('is_active', false);

    if (error) {
      console.error('Error fetching spaces:', error);
    } else {
      setSpaces(data || []);
    }
    setLoading(false);
  };

  const approveSpace = async (id: string) => {
    const { error } = await supabase
      .from('parking_spaces')
      .update({ is_active: true })
      .eq('id', id);

    if (error) {
      alert('Error approving space: ' + error.message);
    } else {
      alert('Space approved successfully!');
      fetchPendingSpaces();
    }
  };

  if (loading) {
    return <div>Loading pending listings...</div>;
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <h1>LivePark Admin Panel</h1>
        <p>Moderation Queue</p>
      </header>

      <main>
        <h2>Pending Approvals ({spaces.length})</h2>
        {spaces.length === 0 ? (
          <p>No pending spaces to review.</p>
        ) : (
          <ul className="space-list">
            {spaces.map((space) => (
              <li key={space.id} className="space-card">
                <div>
                  <h3>{space.title}</h3>
                  <p>{space.address_line1}, {space.city}</p>
                  <small>Host ID: {space.host_id}</small>
                </div>
                <button
                  className="approve-button"
                  onClick={() => approveSpace(space.id)}
                >
                  Approve Listing
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
};
