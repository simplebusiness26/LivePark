import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import MapLibreGL, { MapView, Camera, ShapeSource, CircleLayer, UserLocation } from '@maplibre/maplibre-react-native';
import * as Location from 'expo-location';
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

// OpenStreetMap tiles are suitable for testing/MVP but should be replaced
// with a dedicated OSM-based tile provider before significant production traffic.
const OSM_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
      minzoom: 0,
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

const BRIGHTON_COORDS = [-0.137163, 50.822530];

export const DriverMapScreen: React.FC<Props> = ({ navigation }) => {
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [userCoords, setUserCoords] = useState<number[]>(BRIGHTON_COORDS);

  const signOut = useUserStore((state) => state.signOut);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        let location = await Location.getCurrentPositionAsync({});
        setUserCoords([location.coords.longitude, location.coords.latitude]);
      }
    })();
  }, []);

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
    setLoading(true);
    const { data, error } = await supabase
      .from('parking_spaces')
      .select('id, latitude, longitude, title, hourly_rate_gbp')
      .eq('is_active', true)
      .eq('live_intent_status', 'available_now');

    if (error) {
      console.error('Error fetching spaces', error);
    } else {
      // Safely filter out missing coordinates
      const validSpaces = (data || []).filter(
        (space) => space.latitude != null && space.longitude != null
      );
      setSpaces(validSpaces);
    }
    setLoading(false);
  };

  const handleMarkerPress = (space: ParkingSpace) => {
    setSelectedSpace(space);
  };

  const features = {
    type: 'FeatureCollection',
    features: spaces.map((space) => ({
      type: 'Feature',
      id: space.id,
      geometry: {
        type: 'Point',
        coordinates: [space.longitude, space.latitude], // MapLibre takes [lng, lat]
      },
      properties: {
        ...space,
      },
    })),
  };

  return (
    <View style={styles.container}>
      {loading && spaces.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#00C853" />
          <Text style={{ marginTop: 10 }}>Loading live map...</Text>
        </View>
      ) : (
        <MapView
          style={styles.map}
          mapStyle={JSON.stringify(OSM_STYLE)}
          logoEnabled={false}
        >
          <Camera
            defaultSettings={{
              centerCoordinate: userCoords, // Defaults to Brighton or device location
              zoomLevel: 14,
            }}
            animationDuration={200}
          />

          {hasLocationPermission && (
            <UserLocation visible={true} showsUserHeadingIndicator={true} />
          )}

          <ShapeSource
            id="parkingSpaces"
            shape={features as any}
            onPress={(event: any) => {
              const feature = event.features[0];
              if (feature && feature.properties) {
                handleMarkerPress(feature.properties as ParkingSpace);
              }
            }}
          >
            <CircleLayer
              id="parkingSpacesLayer"
              style={{
                circleRadius: 8,
                circleColor: '#00C853',
                circleStrokeWidth: 2,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </ShapeSource>
        </MapView>
      )}

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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
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
