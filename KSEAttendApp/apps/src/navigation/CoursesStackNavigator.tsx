import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CoursesManagementScreen from '../screens/CoursesManagementScreen';
import CourseDetailScreen from '../screens/teacher/CourseDetailScreen';

const Stack = createNativeStackNavigator();

export default function CoursesStackNavigator({ viewerRole, HeaderComponent }: any) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CoursesList">
        {(props) => (
          <CoursesManagementScreen 
            {...props} 
            viewerRole={viewerRole} 
            HeaderComponent={HeaderComponent} 
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} />
    </Stack.Navigator>
  );
}