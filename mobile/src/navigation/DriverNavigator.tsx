import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DriverMapScreen } from '../screens/DriverMapScreen';
import { BookingConfirmationScreen } from '../screens/BookingConfirmationScreen';
import { ActiveSessionScreen } from '../screens/ActiveSessionScreen';

const Stack = createNativeStackNavigator();

export const DriverNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DriverMap" component={DriverMapScreen} />
      <Stack.Screen name="BookingConfirmation" component={BookingConfirmationScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ActiveSession" component={ActiveSessionScreen} />
    </Stack.Navigator>
  );
};
