import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen';
import StudentDrawerNavigator from './DrawerNavigator';
import TeacherDrawerNavigator from './TeacherDrawerNavigator';
import AdminDrawerNavigator from './AdminDrawerNavigator';
import QRScannerScreen from '../screens/QRScannerScreen';
import QRGeneratorScreen from '../screens/teacher/QRGeneratorScreen';
import NoEnrollmentsScreen from '../screens/NoEnrollmentsScreen';
import { useAuth } from '../screens/context/AuthContext';

export type RootStackParamList = {
  Login: undefined;
  StudentDrawer: undefined;
  TeacherDrawer: undefined;
  AdminDrawer: undefined;
  NoEnrollments: undefined;
  QRScanner: {
    courseId?: string;
    eventId?: string;
    qrToken?: string;
  };
  QRGenerator: {
    courseId: string;
    eventId: string;
    courseTitle: string;
    eventType: string;
    group: string;
    totalStudents: number;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const linking = {
  prefixes: ['eduattend://', 'exp://'],
  config: {
    screens: {
      QRScanner: {
        path: 'attend',
        parse: {
          courseId: (course_id: string) => course_id,
          eventId: (event_id: string) => event_id,
          qrToken: (qr_token: string) => qr_token,
        },
      },
    },
  },
};

function getInitialRoute(role: string | null | undefined): keyof RootStackParamList {
  if (role === 'admin')   return 'AdminDrawer';
  if (role === 'teacher') return 'TeacherDrawer';
  if (role === 'student') return 'StudentDrawer';
  return 'NoEnrollments';
}

export default function RootNavigator() {
  const { token, activeRole } = useAuth();

  const initialRoute = token ? getInitialRoute(activeRole) : 'Login';

  return (
    <NavigationContainer 
      linking={linking} 
      key={`${token ?? 'no-token'}-${activeRole}`}
    >
      <Stack.Navigator
        initialRouteName={initialRoute as any}
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Login"         component={LoginScreen} />
        <Stack.Screen name="StudentDrawer" component={StudentDrawerNavigator as any} />
        <Stack.Screen name="TeacherDrawer" component={TeacherDrawerNavigator as any} />
        <Stack.Screen name="AdminDrawer"   component={AdminDrawerNavigator as any} />
        <Stack.Screen name="NoEnrollments" component={NoEnrollmentsScreen as any} />
        <Stack.Screen name="QRScanner"     component={QRScannerScreen as any} />
        <Stack.Screen name="QRGenerator"   component={QRGeneratorScreen as any} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}