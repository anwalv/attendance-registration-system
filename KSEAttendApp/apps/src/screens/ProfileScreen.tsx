import React from 'react';
import {
  View, Text, TextInput, StyleSheet, SafeAreaView
} from 'react-native';
import { useAuth } from './context/AuthContext'; 

export default function ProfileScreen({ viewerRole, HeaderComponent }: any) {
  const { user: contextUser } = useAuth(); 
  
  const name = contextUser?.name || '';
  const email = contextUser?.email || '';

  const roleColors = { admin: '#E0962B', teacher: '#F4A72B', student: '#7B88FF' };
  const themeColor = roleColors[viewerRole as keyof typeof roleColors] || '#7B88FF';

  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <SafeAreaView style={s.safeArea}>
      <HeaderComponent title="Мій профіль" subtitle="Налаштування акаунта" />
      
      <View style={s.body}>
        <View style={s.avatarContainer}>
          <View style={[s.avatar, { backgroundColor: `${themeColor}22` }]}>
            <Text style={[s.avatarText, { color: themeColor }]}>{initial}</Text>
          </View>
          <View style={[s.badge, { borderColor: themeColor, backgroundColor: `${themeColor}11` }]}>
            <Text style={[s.badgeText, { color: themeColor }]}>{viewerRole?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.formGroup}>
          <Text style={s.label}>ПІБ</Text>
          <TextInput 
            style={[s.input, s.readOnlyInput]} 
            value={name} 
            editable={false} 
          />
        </View>

        <View style={s.formGroup}>
          <Text style={s.label}>Email (Google)</Text>
          <TextInput 
            style={[s.input, s.readOnlyInput]} 
            value={email} 
            editable={false} 
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#12111A' },
  body: { padding: 20, gap: 20 },
  avatarContainer: { alignItems: 'center', marginBottom: 10 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: 'bold' },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  formGroup: { gap: 8 },
  label: { color: '#9896B0', fontSize: 12, fontWeight: '600' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 14, color: '#F0EEF8', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  readOnlyInput: { opacity: 0.6, backgroundColor: 'transparent' }
});