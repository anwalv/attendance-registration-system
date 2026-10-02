import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DrawerNavigationProp } from '@react-navigation/drawer';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './context/AuthContext';

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: { icon: string; onPress: () => void; label?: string };
}

const ROLE_STYLE = {
  teacher: {
    avatarColor: '#F4A72B',
    avatarBorder: 'rgba(244,167,43,0.4)',
    profileScreen: 'TeacherProfile',
    initial: 'А',
  },
  student: {
    avatarColor: '#5B4CFA',
    avatarBorder: 'rgba(91,76,250,0.4)',
    profileScreen: 'StudentProfile',
    initial: 'А',
  },
  admin: {
    avatarColor: '#F4A72B',
    avatarBorder: 'rgba(244,167,43,0.4)',
    profileScreen: 'AdminProfile',
    initial: 'А',
  },
  none: {
    avatarColor: '#5B4CFA',
    avatarBorder: 'rgba(91,76,250,0.4)',
    profileScreen: 'StudentProfile',
    initial: 'А',
  },
};

export default function SharedHeader({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
}: Props) {
  const navigation = useNavigation<DrawerNavigationProp<any>>();
  const { activeRole, user } = useAuth();

  const roleStyle = ROLE_STYLE[activeRole] ?? ROLE_STYLE.student;
  const initial = user?.name?.[0]?.toUpperCase() ?? roleStyle.initial;

  return (
    <View style={s.header}>
      {/* Left — burger або back */}
      <View style={s.left}>
        {showBack ? (
          <TouchableOpacity
            style={s.backBtn}
            onPress={onBack ?? (() => navigation.goBack())}
          >
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            style={s.burgerBtn}
          >
            <View style={s.burgerLine} />
            <View style={s.burgerLine} />
            <View style={s.burgerLine} />
          </TouchableOpacity>
        )}
      </View>

      {/* Center — title + subtitle */}
      <View style={s.center}>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {subtitle && <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text>}
      </View>

      {/* Right — custom action або avatar */}
      <View style={s.right}>
        {rightAction ? (
          <TouchableOpacity style={s.rightBtn} onPress={rightAction.onPress}>
            <Text style={s.rightBtnIcon}>{rightAction.icon}</Text>
            {rightAction.label && (
              <Text style={s.rightBtnLabel}>{rightAction.label}</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={s.avatarBtn}
            onPress={() => navigation.navigate(roleStyle.profileScreen)}
          >
            <View style={[
              s.avatar,
              {
                backgroundColor: roleStyle.avatarColor,
                borderColor: roleStyle.avatarBorder,
              },
            ]}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const C = {
  bg: '#12111A', surface: '#1C1B27',
  textPrimary: '#F0EEF8', textSecondary: '#9896B0',
  white: '#FFFFFF', divider: 'rgba(255,255,255,0.08)',
};

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: C.bg,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
    gap: 12,
  },
  left:   { width: 44, alignItems: 'flex-start' },
  center: { flex: 1, alignItems: 'center' },
  right:  { width: 44, alignItems: 'flex-end' },

  burgerBtn: { padding: 4, gap: 5 },
  burgerLine: {
    width: 22, height: 2, backgroundColor: C.textPrimary,
    borderRadius: 2, marginVertical: 2,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  backIcon: { color: C.textPrimary, fontSize: 18, lineHeight: 22 },

  title:    { color: C.textPrimary, fontSize: 16, fontWeight: '700' },
  subtitle: { color: C.textSecondary, fontSize: 11, marginTop: 1 },

  rightBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  rightBtnIcon:  { fontSize: 15 },
  rightBtnLabel: { color: C.textPrimary, fontSize: 12, fontWeight: '600' },

  avatarBtn: {},
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  avatarText: { color: C.white, fontWeight: '800', fontSize: 14 },
});