import React from 'react';
import { StatusBar, View, ActivityIndicator } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/screens/context/AuthContext';

function AppContent() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#12111A' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return <RootNavigator />;
}

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#12111A" />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </>
  );
}