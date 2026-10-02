import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, StatusBar } from 'react-native';
import { useAuth } from './context/AuthContext';

export default function NoEnrollmentsScreen() {
  const { logout, user } = useAuth();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#12111A" />
      
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📭</Text>
        </View>
        
        <Text style={styles.title}>Вітаю, {user?.name?.split(' ')[0] || 'Користувачу'}!</Text>
        
        <Text style={styles.description}>
          Схоже, вас ще не додали до жодного курсу. {'\n\n'}
          Коли викладач або адміністратор додасть вашу електронну пошту ({user?.email}) до списку учасників курсу, він автоматично з'явиться тут.
        </Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutBtnText}>Вийти з акаунту</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#12111A' 
  },
  container: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    paddingHorizontal: 30 
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: { 
    fontSize: 48 
  },
  title: { 
    color: '#F0EEF8', 
    fontSize: 24, 
    fontWeight: '800', 
    marginBottom: 16,
    textAlign: 'center'
  },
  description: { 
    color: '#9896B0', 
    fontSize: 15, 
    textAlign: 'center', 
    lineHeight: 22,
    marginBottom: 40 
  },
  logoutBtn: { 
    backgroundColor: 'rgba(244,72,94,0.15)', 
    borderWidth: 1,
    borderColor: '#F4485E',
    borderRadius: 14, 
    paddingVertical: 16, 
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center'
  },
  logoutBtnText: { 
    color: '#F4485E', 
    fontSize: 15, 
    fontWeight: '700' 
  },
});