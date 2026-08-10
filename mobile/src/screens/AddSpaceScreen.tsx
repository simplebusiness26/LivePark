import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface Props {
  navigation: NativeStackNavigationProp<any, any>;
}

export const AddSpaceScreen: React.FC<Props> = ({ navigation }) => {
  const user = useUserStore((state) => state.user);
  const [title, setTitle] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [vehicleSize, setVehicleSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;
    setLoading(true);

    // Mock geolocation for MVP
    const mockLat = 51.5074;
    const mockLng = -0.1278;

    const { error } = await supabase.from('parking_spaces').insert({
      host_id: user.id,
      title,
      address_line1: addressLine1,
      city,
      postcode,
      latitude: mockLat,
      longitude: mockLng,
      location: `POINT(${mockLng} ${mockLat})`, // PostGIS Geography point format Long Lat
      hourly_rate_gbp: parseFloat(hourlyRate),
      max_vehicle_size: vehicleSize,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Parking space added successfully!');
      navigation.goBack();
    }
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Add Your Driveway</Text>

      <Text style={styles.label}>Listing Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Secure Victorian Driveway" />

      <Text style={styles.label}>Address Line 1</Text>
      <TextInput style={styles.input} value={addressLine1} onChangeText={setAddressLine1} placeholder="123 Main St" />

      <Text style={styles.label}>City</Text>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="London" />

      <Text style={styles.label}>Postcode</Text>
      <TextInput style={styles.input} value={postcode} onChangeText={setPostcode} placeholder="SW1A 1AA" />

      <Text style={styles.label}>Hourly Rate (£)</Text>
      <TextInput
        style={styles.input}
        value={hourlyRate}
        onChangeText={setHourlyRate}
        placeholder="3.50"
        keyboardType="decimal-pad"
      />

      <Button
        title={loading ? 'Saving...' : 'Publish Space'}
        onPress={handleSubmit}
        disabled={loading}
        color="#00C853"
      />
      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F9FAFB',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#111827',
  },
  label: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 8,
    fontWeight: '500',
  },
  input: {
    height: 50,
    borderColor: '#E5E7EB',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
  },
});
