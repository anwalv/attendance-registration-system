import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Modal, Animated, Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuth } from './context/AuthContext'; 

const BACKEND_URL = 'https://attendance-registration-system-1.onrender.com'; 

function ResultModal({
  visible,
  result,
  onClose,
}: {
  visible: boolean;
  result: { success: boolean; courseTitle?: string; eventType?: string; room?: string; error?: string } | null;
  onClose: () => void;
}) {
  const scale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scale, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
    } else {
      scale.setValue(0.8);
    }
  }, [visible]);

  if (!result) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={ms.overlay}>
        <Animated.View style={[ms.card, { transform: [{ scale }] }]}>
          <Text style={ms.icon}>{result.success ? '✅' : '❌'}</Text>
          <Text style={ms.title}>
            {result.success ? 'Присутність зареєстровано!' : 'Помилка реєстрації'}
          </Text>

          {result.success ? (
            <>
              <Text style={ms.courseName}>{result.courseTitle}</Text>
              <View style={ms.details}>
                <Text style={ms.detail}>📋 {result.eventType}</Text>
                <Text style={ms.detail}>📍 {result.room}</Text>
                <Text style={ms.detail}>🕐 {new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <View style={ms.successBadge}>
                <Text style={ms.successBadgeText}>Твоя явка зафіксована 🎉</Text>
              </View>
            </>
          ) : (
            <Text style={ms.errorText}>{result.error}</Text>
          )}

          <TouchableOpacity style={[ms.btn, !result.success && ms.btnRetry]} onPress={onClose}>
            <Text style={ms.btnText}>{result.success ? 'Закрити' : 'Спробувати ще раз'}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ScanFrame({ active }: { active: boolean }) {
  const color = active ? '#23C97D' : '#5B4CFA';
  const size = 240;
  const corner = 24;
  const thick = 4;

  const corner_style = (top: boolean, left: boolean) => ({
    position: 'absolute' as const,
    width: corner, height: corner,
    borderColor: color,
    borderTopWidth:     top  ? thick : 0,
    borderBottomWidth: !top ? thick : 0,
    borderLeftWidth:   left  ? thick : 0,
    borderRightWidth:  !left ? thick : 0,
    top:    top  ? 0 : undefined,
    bottom: !top ? 0 : undefined,
    left:   left  ? 0 : undefined,
    right:  !left ? 0 : undefined,
  });

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      <View style={corner_style(true,  true)} />
      <View style={corner_style(true,  false)} />
      <View style={corner_style(false, true)} />
      <View style={corner_style(false, false)} />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
interface Props {
  route?: {
    params?: {
      courseId?: string;
      eventId?: string;
      courseTitle?: string;
      eventType?: string;
      room?: string;
    };
  };
  navigation?: any;
}

export default function QRScannerScreen({ route, navigation }: Props) {
  const { token, authHeader } = useAuth();

  const eventId = route?.params?.eventId ?? '101'; 
  const courseTitle = route?.params?.courseTitle ?? 'Криптографічні Системи Безпеки';
  const eventType = route?.params?.eventType ?? 'Лекція';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned]           = useState(false);
  const [result, setResult]             = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // Web fallback — camera not supported
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Сканування QR</Text>
        </View>
        <View style={s.center}>
          <Text style={s.webIcon}>📱</Text>
          <Text style={s.webTitle}>Відкрий застосунок на телефоні</Text>
          <Text style={s.webSub}>Сканування QR доступне лише з мобільного пристрою</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Permission not granted yet
  if (!permission) return <View style={s.safeArea} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={s.safeArea}>
        <StatusBar barStyle="light-content" />
        <View style={s.header}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
            <Text style={s.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Дозвіл на камеру</Text>
        </View>
        <View style={s.center}>
          <Text style={s.permIcon}>📷</Text>
          <Text style={s.permTitle}>Потрібен доступ до камери</Text>
          <Text style={s.permSub}>
            Щоб сканувати QR-код і зареєструвати присутність, надай застосунку дозвіл на використання камери.
          </Text>
          <TouchableOpacity style={s.permBtn} onPress={requestPermission}>
            <Text style={s.permBtnText}>Надати доступ до камери</Text>
          </TouchableOpacity>
          {permission.canAskAgain === false && (
            <Text style={s.permHint}>
              Якщо кнопка не працює — відкрий Налаштування → EduAttend → Камера → Дозволити
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
  
    if (!token) {
      setResult({
        success: false,
        error: 'Помилка авторизації: токен користувача відсутній. Перезайдіть у додаток.',
      });
      setModalVisible(true);
      return;
    }
  
    // Дістаємо qr_token з deep-link URL незалежно від схеми (exp://, eduattend://)
    const qrTokenMatch = data.match(/[?&]qr_token=([^&]+)/);
    const qrTokenPayload = qrTokenMatch ? decodeURIComponent(qrTokenMatch[1]) : data;
  
    try {
      const response = await fetch(`${BACKEND_URL}/attendance/checkin`, {
        method: 'POST',
        headers: {
          ...authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ qr_token: qrTokenPayload }),
      });
  
      const resData = await response.json();
  
      if (response.ok) {
        setResult({
          success: true,
          courseTitle: resData.course_title || courseTitle,
          eventType: resData.event_type || eventType,
        });
      } else {
        setResult({
          success: false,
          error: resData.error || 'Помилка валідації токена',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Не вдалося з’єднатися з сервером. Перевір інтернет-з’єднання.',
      });
    }
  
    setModalVisible(true);
  };

  const handleClose = () => {
    setModalVisible(false);
    if (result?.success) {
      navigation?.goBack();
    } else {
      setTimeout(() => setScanned(false), 500);
    }
  };

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Камера на весь екран */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />

      {/* Напівпрозорий оверлей із рамкою фокусу */}
      <View style={s.overlay}>
        <View style={s.overlayTop} />
        <View style={s.overlayMiddle}>
          <View style={s.overlaySide} />
          <ScanFrame active={scanned} />
          <View style={s.overlaySide} />
        </View>
        <View style={s.overlayBottom}>
          <Text style={s.scanHint}>
            {scanned ? '⏳ Обробка запиту сервером...' : 'Наведи камеру на QR-код викладача'}
          </Text>
          <TouchableOpacity style={s.cancelBtn} onPress={() => navigation?.goBack()}>
            <Text style={s.cancelBtnText}>Скасувати</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Шапка екрана поверх камери */}
      <View style={s.headerOverlay}>
        <TouchableOpacity style={s.backBtnOverlay} onPress={() => navigation?.goBack()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.headerTitleOverlay}>Сканування QR</Text>
        <View style={{ width: 40 }} />
      </View>

      <ResultModal visible={modalVisible} result={result} onClose={handleClose} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#12111A' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 12,
  },
  headerTitle: { color: '#F0EEF8', fontSize: 16, fontWeight: '700' },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1C1B27', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#F0EEF8', fontSize: 18 },
  overlay: { ...StyleSheet.absoluteFillObject, flexDirection: 'column' },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayMiddle: { flexDirection: 'row', height: 240 },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  overlayBottom: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center', paddingTop: 32, gap: 20,
  },
  scanHint: { color: 'white', fontSize: 15, fontWeight: '500', textAlign: 'center', paddingHorizontal: 40 },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 32,
  },
  cancelBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
  headerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 48, paddingBottom: 14,
  },
  backBtnOverlay: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitleOverlay: { color: 'white', fontSize: 16, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  webIcon: { fontSize: 56 },
  webTitle: { color: '#F0EEF8', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  webSub: { color: '#9896B0', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permIcon: { fontSize: 56 },
  permTitle: { color: '#F0EEF8', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  permSub: { color: '#9896B0', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  permBtn: {
    backgroundColor: '#5B4CFA', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 8,
  },
  permBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  permHint: { color: '#9896B0', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 8 },
});

const ms = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#1C1B27', borderRadius: 24,
    padding: 28, alignItems: 'center', gap: 12, width: '100%', maxWidth: 340,
  },
  icon: { fontSize: 52 },
  title: { color: '#F0EEF8', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  courseName: { color: '#7B88FF', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  details: { gap: 6, alignSelf: 'stretch' },
  detail: { color: '#9896B0', fontSize: 13 },
  successBadge: {
    backgroundColor: 'rgba(35,201,125,0.15)', borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(35,201,125,0.3)',
  },
  successBadgeText: { color: '#23C97D', fontSize: 13, fontWeight: '600' },
  errorText: { color: '#F4485E', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: {
    backgroundColor: '#5B4CFA', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32, marginTop: 4, width: '100%', alignItems: 'center',
  },
  btnRetry: { backgroundColor: 'rgba(244,72,94,0.2)', borderWidth: 1, borderColor: '#F4485E' },
  btnText: { color: 'white', fontSize: 15, fontWeight: '700' },
});