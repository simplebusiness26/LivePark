import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  navigation: NativeStackNavigationProp<any, any>;
}

export const HostDashboard: React.FC<Props> = ({ navigation }) => {
  const user = useUserStore((state) => state.user);
  const signOut = useUserStore((state) => state.signOut);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false); // To show if it's approved

  useEffect(() => {
    fetchSpace();
  }, []);

  const fetchSpace = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('parking_spaces')
      .select('id, live_intent_status, is_active')
      .eq('host_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching space', error);
    } else if (data) {
      setSpaceId(data.id);
      setIsLive(data.live_intent_status === 'available_now');
      setIsActive(data.is_active);
    }
    setLoading(false);
  };

  const toggleLiveIntent = async () => {
    if (!spaceId) {
      Alert.alert('No Space', 'Please add a parking space first.', [
        { text: 'Add Space', onPress: () => navigation.navigate('AddSpace') },
        { text: 'Cancel', style: 'cancel' }
      ]);
      return;
    }

    if (!isActive) {
      Alert.alert('Pending Approval', 'Your space must be approved by an admin before you can broadcast.');
      return;
    }

    const newStatus = isLive ? 'offline' : 'available_now';

    // IMPORTANT: Hosts should NOT toggle is_active. That is for admins.
    // They only toggle live_intent_status.
    const { error } = await supabase
      .from('parking_spaces')
      .update({
        live_intent_status: newStatus
      })
      .eq('id', spaceId);

    if (error) {
      Alert.alert('Error', 'Could not update status');
    } else {
      setIsLive(!isLive);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.header}>Host Dashboard</Text>
        <TouchableOpacity onPress={signOut}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {spaceId && !isActive && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingText}>Your space is pending admin approval.</Text>
        </View>
      )}

      <View style={styles.statusCard}>
        <Text style={styles.statusTitle}>Active Status</Text>
        <Text style={[styles.statusText, { color: isLive ? '#00C853' : '#6B7280' }]}>
          {isLive ? '● Live & Available' : '● Offline / Ready'}
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          isLive && styles.primaryButtonActive,
          (!isActive || !spaceId) && styles.primaryButtonDisabled
        ]}
        onPress={toggleLiveIntent}
        disabled={!isActive || !spaceId}
      >
        <Text style={styles.primaryButtonText}>
          {isLive ? 'Stop Broadcasting' : 'LEAVING NOW'}
        </Text>
      </TouchableOpacity>

      {!spaceId && (
        <TouchableOpacity
          style={styles.addSpaceButton}
          onPress={() => navigation.navigate('AddSpace')}
        >
          <Text style={styles.addSpaceButtonText}>+ Add Parking Space</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    paddingTop: 60,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  logoutText: {
    color: '#FF3D00',
    fontWeight: '600',
  },
  pendingCard: {
    backgroundColor: '#FEF3C7',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    marginBottom: 20,
  },
  pendingText: {
    color: '#92400E',
    fontWeight: '600',
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  statusTitle: {
    fontSize: 14,
    color: '#6B7280',
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  primaryButton: {
    backgroundColor: '#00C853',
    width: 250,
    height: 250,
    borderRadius: 125,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  primaryButtonActive: {
    backgroundColor: '#FF3D00',
    shadowColor: '#FF3D00',
  },
  primaryButtonDisabled: {
    backgroundColor: '#9CA3AF',
    shadowColor: 'transparent',
    elevation: 0,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  addSpaceButton: {
    marginTop: 40,
    padding: 15,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  addSpaceButtonText: {
    color: '#00C853',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
