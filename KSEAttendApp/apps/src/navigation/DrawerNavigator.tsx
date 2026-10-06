import React, { useMemo } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '../screens/context/AuthContext';
import { BaseDrawerContent, BaseDrawerConfig } from '../navigation/BaseDrawerNavigator';
import HomeScreen from '../screens/student/StudentHomeScreen';
import AchievementsScreen from '../screens/student/AchievementsScreen';
import StatisticsScreen from '../screens/student/StatisticsScreen';
import StudentCoursesScreen from '../screens/student/StudentCoursesScreen';
import CourseDetailsScreen from '../screens/teacher/CourseDetailScreen';

const Drawer = createDrawerNavigator();

export default function DrawerNavigator() {
  const { user } = useAuth();

  const config = useMemo((): BaseDrawerConfig => ({
    user: {
      name: user?.name || 'Гість',
      email: user?.email || '',
      initial: user?.name ? user.name.charAt(0).toUpperCase() : '?',
      avatarColor: '#5B4CFA',
      badgeBg: '#2A2B6E',
      activeBg: 'rgba(91,76,250,0.18)',
      activeDotColor: '#5B4CFA',
    },
    navItems: [
      { key: 'home',         label: 'Головна',    icon: '🏠', screen: 'Home' },
      { key: 'courses',      label: 'Мої курси',  icon: '📚', screen: 'Courses' },
      { key: 'statistics',   label: 'Статистика', icon: '📊', screen: 'Statistics' },
      { key: 'achievements', label: 'Досягнення', icon: '🏆', screen: 'Achievements' },
    ],
  }), [user]);

  return (
    <Drawer.Navigator
      id="student-drawer"
      drawerContent={(props) => <BaseDrawerContent props={props} config={config} />}
      screenOptions={{ headerShown: false, drawerStyle: { width: 280 } }}
    >
      <Drawer.Screen name="Home"         component={HomeScreen} />
      <Drawer.Screen name="Courses"      component={StudentCoursesScreen} />
      <Drawer.Screen name="Statistics"   component={StatisticsScreen} />
      <Drawer.Screen name="Achievements" component={AchievementsScreen} />
      <Drawer.Screen name="CourseDetails" component={CourseDetailsScreen} />
    </Drawer.Navigator>
  );
}