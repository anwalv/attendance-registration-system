import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { BaseDrawerContent } from './BaseDrawerNavigator';
import TeacherHomeScreen from '../screens/teacher/TeacherHomeScreen';
import TeacherStatisticsScreen from '../screens/teacher/TeacherStatisticsScreen';
import UserHeader from '../screens/UserHeader';
import ProfileScreen from '../screens/ProfileScreen';
import { useAuth } from '../screens/context/AuthContext';

import CoursesStackNavigator from './CoursesStackNavigator'; 

const Drawer = createDrawerNavigator();

export default function TeacherDrawerNavigator() {
  const { user } = useAuth();
  const dynamicConfig = {
    user: {
      name: user?.name || 'Викладач',
      email: user?.email || 'немає пошти',
      initial: user?.name ? user.name.charAt(0).toUpperCase() : 'В',
      badgeLabel: 'KSE Teacher',
      avatarColor: '#F4A72B',
      badgeBg: 'rgba(244,167,43,0.18)',
      activeBg: 'rgba(91,76,250,0.18)',
      activeDotColor: '#5B4CFA',
    },
    navItems: [
      { key: 'home',       label: 'Головна',    icon: '🏠', screen: 'TeacherHome' },
      { key: 'courses',    label: 'Мої курси',  icon: '📚', screen: 'TeacherCourses' },
      { key: 'statistics', label: 'Статистика', icon: '📊', screen: 'TeacherStatistics' },
      { key: 'profile',    label: 'Профіль',    icon: '👤', screen: 'TeacherProfile' },
    ],
  };

  return (
    <Drawer.Navigator
      id="teacher-drawer"
      drawerContent={(props) => <BaseDrawerContent props={props} config={dynamicConfig} />}
      screenOptions={{ headerShown: false, drawerStyle: { width: 280 } }}
    >
      <Drawer.Screen name="TeacherHome" component={TeacherHomeScreen} />
      
      <Drawer.Screen name="TeacherCourses">
        {(props) => (
          <CoursesStackNavigator 
            {...props} 
            viewerRole="teacher" 
            HeaderComponent={UserHeader} 
          />
        )}
      </Drawer.Screen>
      
      <Drawer.Screen name="TeacherStatistics" component={TeacherStatisticsScreen} />
      <Drawer.Screen name="TeacherProfile">
        {(props) => <ProfileScreen {...props} viewerRole="teacher" HeaderComponent={UserHeader} />}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
}