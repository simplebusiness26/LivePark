import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

interface Props {
  navigation: NativeStackNavigationProp<any, any>;
  route: RouteProp<any, any>;
}

export const BookingConfirmationScreen: React.FC<Props> = ({ route, navigation }) => {
  const { spaceId } = route.params as any;
  const user = useUserStore((state) => state.user);

  const [space, setSpace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    const fetchSpace = async () => {
      const { data, error } = await supabase
        .from('parking_spaces')
        .select('*')
        .eq('id', spaceId)
        .single();

      if (error) {
        Alert.alert('Error', 'Could not load space details');
        navigation.goBack();
      } else {
        setSpace(data);
      }
      setLoading(false);
    };

    fetchSpace();
  }, [spaceId]);

  const handleBookNow = async () => {
    if (!user) return;
    setBooking(true);

    // Call unified atomic RPC to safely lock row, calculate pricing, insert booking, and set space offline
    const { data: bookingId, error: bookingError } = await supabase.rpc('book_and_claim_space', {
      p_space_id: space.id,
      p_driver_id: user.id
    });

    if (bookingError) {
      Alert.alert('Booking Failed', bookingError.message);
      setBooking(false);
      return;
    }

    Alert.alert('Hold Secured', 'Proceeding to active session.');
    setBooking(false);
    navigation.replace('ActiveSession', { bookingId: bookingId });
  };

  if (loading || !space) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Confirm Booking</Text>

      <View style={styles.detailsCard}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>{space.address_line1}, {space.city}</Text>

        <Text style={styles.label}>Hourly Rate</Text>
        <Text style={styles.value}>£{space.hourly_rate_gbp.toFixed(2)}</Text>
      </View>

      <TouchableOpacity
        style={styles.bookButton}
        onPress={handleBookNow}
        disabled={booking}
      >
        <Text style={styles.bookButtonText}>{booking ? 'Securing hold...' : 'Confirm & Hold'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.goBack()}
        disabled={booking}
      >
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111827',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  bookButton: {
    backgroundColor: '#00C853',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  }
});
