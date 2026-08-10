import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HostDashboard } from '../screens/HostDashboard';
import { AddSpaceScreen } from '../screens/AddSpaceScreen';

const Stack = createNativeStackNavigator();

export const HostNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HostDashboard" component={HostDashboard} />
      <Stack.Screen name="AddSpace" component={AddSpaceScreen} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
};
