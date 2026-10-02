import React, { useMemo } from 'react';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useAuth } from '../screens/context/AuthContext';
import { BaseDrawerContent, BaseDrawerConfig } from '../navigation/BaseDrawerNavigator';
import AdminHomeScreen from '../screens/admin/AdminHomeScreen';
import UsersScreen from '../screens/admin/UsersScreen';
import ImportScreen from '../screens/admin/ImportScreen';
import AdminHeader from '../screens/admin/AdminHeader';
import CoursesStackNavigator from './CoursesStackNavigator'; 
import ProfileScreen from '../screens/ProfileScreen';

const Drawer = createDrawerNavigator();

export default function AdminDrawerNavigator() {
  const { user } = useAuth();
  const config = useMemo((): BaseDrawerConfig => ({
    user: {
      name: user?.name || 'Адміністратор',
      email: user?.email || 'admin@kse.org.ua',
      initial: user?.name ? user.name.charAt(0).toUpperCase() : 'А',
      avatarColor: '#E0962B',
      badgeBg: '#3D2A0F',
      activeBg: 'rgba(224,150,43,0.16)',
      activeDotColor: '#E0962B',
    },
    navItems: [
      { key: 'home',    label: 'Головна',       icon: '🏠', screen: 'AdminHome' },
      { key: 'users',   label: 'Користувачі',   icon: '👥', screen: 'Users' },
      { key: 'courses', label: 'Курси',         icon: '📚', screen: 'CoursesManagement' },
      { key: 'import',  label: 'Імпорт даних',  icon: '📥', screen: 'Import' },
      { key: 'profile', label: 'Профіль',       icon: '👤', screen: 'AdminProfile' }
    ],
    versionLabel: 'EduAttend Admin v1.0.0',
  }), [user]);

  return (
    <Drawer.Navigator
      id="admin-drawer"
      drawerContent={(props) => <BaseDrawerContent props={props} config={config} />}
      screenOptions={{ 
        headerShown: false, 
        drawerStyle: { width: 280 },
        drawerType: 'slide',
        overlayColor: 'transparent',
      }}
    >
      <Drawer.Screen name="AdminHome" component={AdminHomeScreen} />
      <Drawer.Screen name="Users" component={UsersScreen} />
      
      <Drawer.Screen 
        name="CoursesManagement" 
        component={(props: any) => (
          <CoursesStackNavigator {...props} viewerRole="admin" HeaderComponent={AdminHeader} />
        )} 
      />

      <Drawer.Screen name="Import" component={ImportScreen} />

      <Drawer.Screen 
        name="AdminProfile" 
        component={(props: any) => (
          <ProfileScreen {...props} viewerRole="admin" HeaderComponent={AdminHeader} />
        )} 
      />
    </Drawer.Navigator>
  );
}