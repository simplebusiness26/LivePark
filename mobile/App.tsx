import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { supabase } from './src/lib/supabase';
import { useUserStore } from './src/store/userStore';

import { LoginScreen } from './src/screens/LoginScreen';
import { RegisterScreen } from './src/screens/RegisterScreen';
import { HostNavigator } from './src/navigation/HostNavigator';
import { DriverNavigator } from './src/navigation/DriverNavigator';

// Placeholder for future screen to satisfy TypeScript and routing logic
const PlaceholderLoadingScreen = () => null;

const Stack = createNativeStackNavigator();

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const setSession = useUserStore((state) => state.setSession);
  const session = useUserStore((state) => state.session);
  const role = useUserStore((state) => state.role);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsReady(true);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  if (!isReady) {
    return null; // Or a loading spinner
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          // Auth Stack
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : role === 'driver' ? (
          // Driver Stack
          <Stack.Screen name="DriverApp" component={DriverNavigator} />
        ) : role === 'host' ? (
          // Host Stack
          <Stack.Screen name="HostApp" component={HostNavigator} />
        ) : (
          // Fallback loading screen
          <Stack.Screen name="Loading" component={PlaceholderLoadingScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
