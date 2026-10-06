import React, { useRef, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, SafeAreaView,
  StatusBar, Dimensions, Platform, Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuth, API_BASE } from './context/AuthContext';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const { width: W, height: H } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface Props {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Login'>;
}

function FloatingOrb({ size, color, top, left, delay }: {
  size: number; color: string; top: number; left: number; delay: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  return (
    <Animated.View style={[styles.orb, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, top, left, transform: [{ translateY }],
    }]} />
  );
}

function IllustrationPanel() {
  return (
    <LinearGradient
      colors={['#1A0F5E', '#3B2FCC', '#7B3FE4', '#4B9EFF']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={styles.illustrationPanel}
    >
      <FloatingOrb size={180} color="rgba(255,255,255,0.05)" top={-50} left={-50} delay={0} />
      <FloatingOrb size={100} color="rgba(35,201,125,0.15)"  top={300} left={-20} delay={600} />
      <FloatingOrb size={80}  color="rgba(123,136,255,0.2)"  top={80}  left={260} delay={300} />
      <View style={styles.illustrationContent}>
        <View style={styles.letterMark}>
          <Text style={styles.letterMarkText}>KSE</Text>
          <Text style={[styles.letterMarkText, { color: '#23C97D' }]}>Attend</Text>
        </View>
        <Text style={styles.tagline}>
          Цифрова система обліку відвідуваності для університетів. Швидка реєстрація, прозора статистика та зручна аналітика.
        </Text>
      </View>
    </LinearGradient>
  );
}

function NotRegisteredPanel({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <View style={styles.loginPanel}>
      <View style={styles.logoRow}>
        <View style={[styles.logoIcon, { backgroundColor: '#F4485E' }]}>
          <Text style={styles.logoIconText}>🔒</Text>
        </View>
        <View>
          <Text style={styles.logoTitle}>Доступ обмежено</Text>
          <Text style={styles.logoSub}>KSEAttend Security</Text>
        </View>
      </View>

      <View style={styles.errorCard}>
        <Text style={styles.errorCardTitle}>Акаунт не знайдено</Text>
        <Text style={styles.errorCardEmail}>{email}</Text>
        <Text style={styles.errorCardText}>
          Цього корпоративного Google-акаунта немає в базі даних системи відвідуваності.
        </Text>
        <Text style={styles.errorCardHint}>
          Будь ласка, зверніться до адміністратора або вашого менеджера навчальних програм Kyiv School of Economics для внесення вашої пошти до системи.
        </Text>
      </View>

      <TouchableOpacity style={styles.backToLoginBtn} onPress={onBack} activeOpacity={0.8}>
        <Text style={styles.backToLoginBtnText}>Спробувати інший вхід</Text>
      </TouchableOpacity>
    </View>
  );
}

function LoginPanel({ onLogin }: { onLogin: () => void }) {
  return (
    <View style={styles.loginPanel}>
      <View style={styles.logoRow}>
        <View style={styles.logoIcon}><Text style={styles.logoIconText}>KSE</Text></View>
        <View>
          <Text style={styles.logoTitle}>KSEAttend</Text>
          <Text style={styles.logoSub}>Kyiv School of Economics</Text>
        </View>
      </View>

      <View style={styles.btnBlock}>
        <TouchableOpacity style={styles.googleBtn} onPress={onLogin} activeOpacity={0.88}>
          <View style={styles.googleLogo}><Text style={styles.googleLogoText}>G</Text></View>
          <Text style={styles.googleBtnText}>Увійти через Google</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>
          Використовуйте корпоративний акаунт KSE (@kse.org.ua) для входу в систему.
        </Text>
      </View>
    </View>
  );
}

export default function LoginScreen({ navigation }: Props) {
  const { setToken } = useAuth();
  const [unregisteredEmail, setUnregisteredEmail] = useState<string | null>(null);

  useEffect(() => {
    if (isWeb) {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      const email = params.get('email');
      if (error === 'not_registered' && email) {
        setUnregisteredEmail(email);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    const mobileRedirectScheme = 'eduattend://';
    const mobileDevRedirect = 'exp://192.168.0.13:8081/--/';
    const clientRedirectUri = isWeb 
      ? window.location.origin 
      : (__DEV__ ? mobileDevRedirect : mobileRedirectScheme);
    const authUrl = `${API_BASE}/auth/google/login?redirect_uri=${encodeURIComponent(clientRedirectUri)}`;

    if (isWeb) {
      window.location.href = authUrl;
    } else {
      try {
        const result = await WebBrowser.openAuthSessionAsync(authUrl, mobileRedirectScheme);
        if (result.type === 'success' && result.url) {
          const tokenMatch = result.url.match(/[?&]token=([^&#]+)/);
          if (tokenMatch?.[1]) {
            await setToken(tokenMatch[1]);
            return;
          }
          const errorMatch = result.url.match(/[?&]error=([^&#]+)/);
          const emailMatch = result.url.match(/[?&]email=([^&#]+)/);
          if (errorMatch?.[1] === 'not_registered' && emailMatch?.[1]) {
            setUnregisteredEmail(decodeURIComponent(emailMatch[1]));
          }
        }
      } catch (error) {
        console.error('Помилка авторизації на мобільному пристрої:', error);
      }
    }
  };

  const handleResetError = () => {
    setUnregisteredEmail(null);
  };

  const renderPanel = () => {
    if (unregisteredEmail) {
      return <NotRegisteredPanel email={unregisteredEmail} onBack={handleResetError} />;
    }
    return (
      <LoginPanel onLogin={handleGoogleLogin} />
    );
  };

  if (isWeb) {
    return (
      <View style={styles.webRoot}>
        <StatusBar barStyle="light-content" />
        <View style={styles.webLeft}><IllustrationPanel /></View>
        <View style={styles.webRight}>
          {renderPanel()}
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.mobileRoot}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <IllustrationPanel />
      <View style={styles.mobileSheet}>
        <View style={styles.mobileSheetHandle} />
        {renderPanel()}
      </View>
    </SafeAreaView>
  );
}

const C = {
  bg: '#12111A', surface: '#1C1B27', surfaceHigh: '#252436',
  accent: '#5B4CFA', green: '#23C97D',
  textPrimary: '#F0EEF8', textSecondary: '#9896B0',
  white: '#FFFFFF', divider: 'rgba(255,255,255,0.08)',
};

const styles = StyleSheet.create({
  webRoot: { flex: 1, flexDirection: 'row', backgroundColor: C.bg, minHeight: '100vh' as any },
  webLeft: { flex: 3 },
  webRight: {
    width: 400, backgroundColor: C.bg, justifyContent: 'center',
    paddingHorizontal: 48, borderLeftWidth: 1, borderLeftColor: C.divider,
  },

  mobileRoot: { flex: 1, backgroundColor: C.bg },
  mobileSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32,
    paddingHorizontal: 28, paddingBottom: 48, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: 'rgba(91,76,250,0.3)',
  },
  mobileSheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 24,
  },

  illustrationPanel: { flex: 1, overflow: 'hidden', position: 'relative' },
  illustrationContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 40, paddingVertical: 48, gap: 16 },
  orb: { position: 'absolute' },
  letterMark: { flexDirection: 'row' },
  letterMarkText: { fontSize: 52, fontWeight: '900', color: C.white, letterSpacing: -1 },
  tagline: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 19, maxWidth: 340 },

  loginPanel: { gap: 24 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  logoIconText: { color: C.white, fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
  logoTitle: { color: C.textPrimary, fontSize: 17, fontWeight: '800' },
  logoSub: { color: C.textSecondary, fontSize: 11, marginTop: 1 },

  btnBlock: { gap: 10 },
  googleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.white, borderRadius: 14,
    paddingVertical: 15, paddingHorizontal: 24, gap: 12,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
  },
  googleLogo: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center' },
  googleLogoText: { color: C.white, fontSize: 13, fontWeight: '900' },
  googleBtnText: { color: '#1A1A2E', fontSize: 15, fontWeight: '700' },
  hint: { color: C.textSecondary, fontSize: 12, lineHeight: 18 },

  errorCard: {
    backgroundColor: '#1C1B27',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(244, 72, 94, 0.25)',
    gap: 8,
  },
  errorCardTitle: {
    color: '#F4485E',
    fontSize: 15,
    fontWeight: '800',
  },
  errorCardEmail: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  errorCardText: {
    color: C.textPrimary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    marginTop: 4,
  },
  errorCardHint: {
    color: C.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  backToLoginBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  backToLoginBtnText: {
    color: C.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});