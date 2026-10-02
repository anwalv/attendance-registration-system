import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { DrawerNavigationProp } from '@react-navigation/drawer';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: { 
    icon: string; 
    label?: string; 
    onPress: () => void 
  };
}

const MOCK_ADMIN = {
  initial: 'АH',
};

export default function AdminHeader({ title, subtitle, rightAction }: AdminHeaderProps) {
  const navigation = useNavigation<DrawerNavigationProp<any>>();

  return (
    <View style={styles.header}>
      {/* Burger Menu */}
      <TouchableOpacity onPress={() => navigation.openDrawer()} style={styles.burgerBtn}>
        <View style={styles.burgerLine} />
        <View style={styles.burgerLine} />
        <View style={styles.burgerLine} />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {rightAction ? (
        <TouchableOpacity style={styles.rightActionBtn} onPress={rightAction.onPress}>
          <Text style={styles.rightActionIcon}>{rightAction.icon}</Text>
          {rightAction.label && (
            <Text style={styles.rightActionLabel}>{rightAction.label}</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={styles.headerAvatar} 
          onPress={() => navigation.navigate('AdminProfile')}
          activeOpacity={0.7}
        >
          <Text style={styles.headerAvatarText}>{MOCK_ADMIN.initial}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const colors = {
  textPrimary: '#F0EEF8',
  textSecondary: '#9896B0',
  accent: '#E0962B',
  white: '#FFFFFF',
  actionBg: 'rgba(255,255,255,0.1)',
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  burgerBtn: { gap: 5, padding: 4 },
  burgerLine: {
    width: 22,
    height: 2,
    backgroundColor: colors.textPrimary,
    borderRadius: 2,
    marginVertical: 2,
  },
  titleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  headerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarText: { 
    color: colors.white, 
    fontWeight: '800', 
    fontSize: 14 
  },
  rightActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.actionBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
  },
  rightActionIcon: {
    fontSize: 14,
  },
  rightActionLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});