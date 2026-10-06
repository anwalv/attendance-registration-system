import React from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeScreen from '../screens/student/StudentHomeScreen';
import AchievementsScreen from '../screens/student/AchievementsScreen';
import StatisticsScreen from '../screens/student/StatisticsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import CourseDetailsScreen from '../screens/teacher/CourseDetailScreen';
import { BaseDrawerConfig, BaseDrawerContent } from './BaseDrawerNavigator';
import UserHeader from '../screens/UserHeader';
import StudentCoursesScreen from '../screens/student/StudentCoursesScreen';
import { useAuth } from '../screens/context/AuthContext';

const Drawer = createDrawerNavigator();

export default function StudentDrawerNavigator() {
  const { user } = useAuth();

  const dynamicConfig = {
    user: {
      name: user?.name || 'Гість',
      email: user?.email || 'немає пошти',
      initial: user?.name ? user.name.charAt(0).toUpperCase() : '?',
      badgeLabel: 'KSE Student',
      avatarColor: '#5B4CFA',
      badgeColor: '#7B88FF',
      badgeBg: '#2A2B6E',
      activeBg: 'rgba(91,76,250,0.18)',
      activeDotColor: '#5B4CFA',
    },
    navItems: [
      { key: 'home',         label: 'Головна',    icon: '🏠', screen: 'StudentHome' },
      { key: 'courses',      label: 'Мої курси',  icon: '📚', screen: 'StudentCourses' },
      { key: 'statistics',   label: 'Статистика', icon: '📊', screen: 'StudentStatistics' },
      { key: 'achievements', label: 'Досягнення', icon: '🏆', screen: 'StudentAchievements' },
      { key: 'profile',      label: 'Профіль',    icon: '👤', screen: 'StudentProfile' },
    ],
  };

  return (
    <Drawer.Navigator
      id="student-drawer"
      drawerContent={(props) => <BaseDrawerContent props={props} config={dynamicConfig} />}
      screenOptions={{ headerShown: false, drawerStyle: { width: 280 } }}
    >
      <Drawer.Screen name="StudentHome"         component={HomeScreen} />
      <Drawer.Screen name="StudentCourses"      component={StudentCoursesScreen} />
      <Drawer.Screen name="StudentStatistics"   component={StatisticsScreen} />
      <Drawer.Screen name="StudentAchievements" component={AchievementsScreen} />
      <Drawer.Screen name="CourseDetails"       component={CourseDetailsScreen} />
      <Drawer.Screen name="StudentProfile">
        {(props) => (
          <ProfileScreen {...props} viewerRole="student" HeaderComponent={UserHeader} />
        )}
      </Drawer.Screen>
    </Drawer.Navigator>
  );
}