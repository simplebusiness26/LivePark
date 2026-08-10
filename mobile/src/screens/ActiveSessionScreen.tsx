import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../lib/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';

interface Props {
  navigation: NativeStackNavigationProp<any, any>;
  route: RouteProp<any, any>;
}

export const ActiveSessionScreen: React.FC<Props> = ({ route, navigation }) => {
  const { bookingId } = route.params as any;
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  const fetchBooking = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, parking_spaces(address_line1, city)')
      .eq('id', bookingId)
      .single();

    if (error) {
      Alert.alert('Error', 'Could not load active session.');
      navigation.goBack();
    } else {
      setBooking(data);
    }
    setLoading(false);
  };

  const endSession = async () => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'completed' })
      .eq('id', bookingId);

    if (error) {
      Alert.alert('Error', 'Failed to end session.');
    } else {
      Alert.alert('Session Ended', 'Your parking session has been successfully completed.');
      navigation.popToTop(); // Return to map
    }
  };

  if (loading || !booking) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#00C853" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Active Session</Text>

      <View style={styles.sessionCard}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.value}>
          {booking.parking_spaces?.address_line1}, {booking.parking_spaces?.city}
        </Text>

        <Text style={styles.label}>Status</Text>
        <Text style={[styles.value, { color: '#00C853' }]}>Active</Text>

        <Text style={styles.label}>Total Held</Text>
        <Text style={styles.value}>£{booking.total_amount_gbp.toFixed(2)}</Text>
      </View>

      <TouchableOpacity style={styles.endButton} onPress={endSession}>
        <Text style={styles.endButtonText}>End Session & Pay</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#111827', // Dark mode for active session focus
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
    color: '#FFFFFF',
    marginTop: 40,
  },
  sessionCard: {
    backgroundColor: '#1F2937',
    padding: 20,
    borderRadius: 16,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  label: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  value: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  endButton: {
    backgroundColor: '#FF3D00', // Destructive coral red
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  endButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
