import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView,
} from 'react-native';
import { DrawerContentComponentProps } from '@react-navigation/drawer';
import { useAuth, AppRole } from '../screens/context/AuthContext';

export interface NavItem {
  key: string;
  label: string;
  icon: string;
  screen: string;
}

export interface DrawerUser {
  name: string;
  email?: string;
  initial: string;
  avatarColor: string;
  badgeBg: string;
  activeBg: string;
  activeDotColor: string;
}

export interface BaseDrawerConfig {
  user: DrawerUser;
  navItems: NavItem[];
  versionLabel?: string;
}

const ROLE_CONFIG: Partial<Record<AppRole, { label: string; icon: string; color: string; bg: string }>> = {
  student: { label: 'Студент',   icon: '🎓', color: '#7B88FF', bg: 'rgba(123,136,255,0.15)' },
  teacher: { label: 'Викладач',  icon: '👨‍🏫', color: '#23C97D', bg: 'rgba(35,201,125,0.15)'  },
  admin:   { label: 'Адмін',     icon: '⚡',  color: '#F4A72B', bg: 'rgba(244,167,43,0.15)'  },
};

function RoleSwitcher() {
  const { availableRoles, activeRole, switchRole } = useAuth();
  const visibleRoles = availableRoles.filter(role => role !== 'none');
  if (visibleRoles.length <= 1) return null;

  return (
    <View style={sw.container}>
      <Text style={sw.label}>Перейти як</Text>
      <View style={sw.pills}>
        {visibleRoles.map((role) => {
          const cfg = ROLE_CONFIG[role];
          
          if (!cfg) return null; 

          const isActive = role === activeRole;
          return (
            <TouchableOpacity
              key={role}
              style={[
                sw.pill,
                { borderColor: cfg.color },
                isActive && { backgroundColor: cfg.bg },
              ]}
              onPress={() => switchRole(role)}
              activeOpacity={0.8}
            >
              <Text style={sw.pillIcon}>{cfg.icon}</Text>
              <Text style={[sw.pillText, { color: isActive ? cfg.color : C.textSecondary }]}>
                {cfg.label}
              </Text>
              {isActive && <View style={[sw.activeDot, { backgroundColor: cfg.color }]} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function BaseDrawerContent({
  props,
  config,
}: {
  props: DrawerContentComponentProps;
  config: BaseDrawerConfig;
}) {
  const { navigation, state } = props;
  const currentRoute = state.routes[state.index]?.name;
  const { user, navItems, versionLabel = 'EduAttend v1.0.0' } = config;
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigation.getParent()?.navigate('Login');
  };

  return (
    <SafeAreaView style={s.container}>
      {/* User header */}
      <View style={s.header}>
        <View style={[s.avatar, { backgroundColor: user.avatarColor }]}>
          <Text style={s.avatarText}>{user.initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{user.name}</Text>
          {user.email && <Text style={s.email}>{user.email}</Text>}
          <View style={[s.badge, { backgroundColor: user.badgeBg }]}>
          </View>
        </View>
      </View>

      <RoleSwitcher />

      <View style={s.divider} />

      {/* Nav items */}
      <ScrollView contentContainerStyle={s.navList} showsVerticalScrollIndicator={false}>
        {navItems.map((item) => {
          const active = currentRoute === item.screen;
          return (
            <TouchableOpacity
              key={item.key}
              style={[s.navItem, active && { backgroundColor: user.activeBg }]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <Text style={s.navIcon}>{item.icon}</Text>
              <Text style={[s.navLabel, active && s.navLabelActive]}>
                {item.label}
              </Text>
              {active && (
                <View style={[s.activeDot, { backgroundColor: user.activeDotColor }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={s.footer}>
        <View style={s.divider} />
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutIcon}>🚪</Text>
          <Text style={s.logoutText}>Вийти</Text>
        </TouchableOpacity>
        <Text style={s.version}>{versionLabel}</Text>
      </View>
    </SafeAreaView>
  );
}

const C = {
  bg: '#12111A', textPrimary: '#F0EEF8',
  textSecondary: '#9896B0', white: '#FFFFFF',
  divider: 'rgba(255,255,255,0.08)',
};

const sw = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  label: {
    color: C.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginLeft: 2,
  },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pillIcon: { fontSize: 13 },
  pillText: { fontSize: 12, fontWeight: '700' },
  activeDot: { width: 5, height: 5, borderRadius: 3 },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center',
    padding: 24, paddingTop: 32, gap: 14,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: C.white, fontWeight: '800', fontSize: 22 },
  name: { color: C.textPrimary, fontWeight: '700', fontSize: 15, marginBottom: 2 },
  email: { color: C.textSecondary, fontSize: 11, marginBottom: 4 },
  badge: {
    alignSelf: 'flex-start', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  divider: { height: 1, backgroundColor: C.divider, marginHorizontal: 20 },
  navList: { paddingVertical: 16, paddingHorizontal: 12, gap: 4 },
  navItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14, borderRadius: 14, gap: 14,
  },
  navIcon: { fontSize: 20 },
  navLabel: { flex: 1, color: C.textSecondary, fontSize: 15, fontWeight: '500' },
  navLabelActive: { color: C.textPrimary, fontWeight: '700' },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  footer: { gap: 12, paddingBottom: 16 },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 26, paddingVertical: 10, gap: 12,
  },
  logoutIcon: { fontSize: 18 },
  logoutText: { color: C.textSecondary, fontSize: 14, fontWeight: '500' },
  version: {
    color: 'rgba(255,255,255,0.2)', fontSize: 11,
    textAlign: 'center', paddingBottom: 8,
  },
});