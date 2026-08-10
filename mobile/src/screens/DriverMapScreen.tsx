import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '../lib/supabase';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUserStore } from '../store/userStore';

interface Props {
  navigation: NativeStackNavigationProp<any, any>;
}

interface ParkingSpace {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  hourly_rate_gbp: number;
}

export const DriverMapScreen: React.FC<Props> = ({ navigation }) => {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const signOut = useUserStore((state) => state.signOut);

  useEffect(() => {
    fetchActiveSpaces();

    // Subscribe to realtime changes on parking_spaces
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_spaces' },
        (payload) => {
          console.log('Realtime update:', payload);
          fetchActiveSpaces();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActiveSpaces = async () => {
    const { data, error } = await supabase
      .from('parking_spaces')
      .select('id, latitude, longitude, title, hourly_rate_gbp')
      .eq('is_active', true)
      .eq('live_intent_status', 'available_now');

    if (error) {
      console.error('Error fetching spaces', error);
    } else {
      setSpaces(data || []);
    }
  };

  const handleMarkerPress = (space: ParkingSpace) => {
    setSelectedSpace(space);
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 51.5074, // Default to London
          longitude: -0.1278,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {spaces.map((space) => (
          <Marker
            key={space.id}
            coordinate={{ latitude: space.latitude, longitude: space.longitude }}
            onPress={() => handleMarkerPress(space)}
            pinColor="#00C853" // Emerald green for available spaces
          />
        ))}
      </MapView>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      {/* Peek Sheet (Bottom Sheet) */}
      {selectedSpace && (
        <View style={styles.peekSheet}>
          <Text style={styles.spaceTitle}>{selectedSpace.title}</Text>
          <Text style={styles.spacePrice}>£{selectedSpace.hourly_rate_gbp.toFixed(2)}/hr</Text>
          <TouchableOpacity
            style={styles.bookButton}
            onPress={() => navigation.navigate('BookingConfirmation', { spaceId: selectedSpace.id })}
          >
            <Text style={styles.bookButtonText}>Book Now</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  logoutButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  logoutText: {
    color: '#FF3D00',
    fontWeight: 'bold',
  },
  peekSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  spaceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  spacePrice: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 16,
  },
  bookButton: {
    backgroundColor: '#00C853',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
