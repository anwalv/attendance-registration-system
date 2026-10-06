import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, StatusBar, Animated,
  ActivityIndicator,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useAuth } from '../context/AuthContext';

const ROTATION_INTERVAL = 10;
const API_BASE_URL = 'https://attendance-registration-system-1.onrender.com';

function buildQrValue(courseId: string, eventId: string, token: string): string {
  const scheme = __DEV__
    ? 'exp://'
    : 'eduattend://';

  const path = 'attend';

  return `${scheme}${path}?course_id=${courseId}&event_id=${eventId}&qr_token=${encodeURIComponent(token)}`;
}

function CountdownRing({ onTrigger }: { onTrigger: () => void }) {
  const [seconds, setSeconds] = useState(ROTATION_INTERVAL);

  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          onTrigger();
          return ROTATION_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onTrigger]);

  const pct = seconds / ROTATION_INTERVAL;
  const color = pct > 0.5 ? '#23C97D' : pct > 0.25 ? '#F4A72B' : '#F4485E';

  return (
    <View style={cr.wrap}>
      <View style={[cr.track, { borderColor: 'rgba(255,255,255,0.1)' }]} />
      <View style={cr.center}>
        <Text style={[cr.num, { color }]}>{seconds}</Text>
        <Text style={cr.sub}>сек</Text>
      </View>
    </View>
  );
}

const cr = StyleSheet.create({
  wrap: { width: 64, height: 64, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  track: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 4 },
  center: { alignItems: 'center' },
  num: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  sub: { color: '#9896B0', fontSize: 9 },
});

interface Props {
  route?: {
    params?: {
      courseId?: string | number;
      eventId?: string | number;
      courseTitle?: string;
      eventType?: string;
      totalStudents?: number;
    };
  };
  navigation?: any;
}

export default function QRGeneratorScreen({ route, navigation }: Props) {
  const { token } = useAuth();

  const courseId    = String(route?.params?.courseId ?? '1');
  const eventId     = String(route?.params?.eventId ?? '1');
  const courseTitle = route?.params?.courseTitle ?? 'Криптографічні Системи Безпеки';
  const eventType   = route?.params?.eventType ?? 'Заняття';

  const [tokenQR, setTokenQR] = useState('');
  const [scanned, setScanned] = useState(0);
  const [totalStudents, setTotalStudents] = useState(route?.params?.totalStudents ?? 0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const qrValue = buildQrValue(courseId, eventId, tokenQR);
  const fetchAttendanceCount = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/events/${eventId}/attendance`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (response.ok) {
        setScanned(data.present);
        setTotalStudents(data.total_students);
      }
    } catch (error) {
      console.error('Помилка оновлення статистики явки:', error);
    }
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    if (!token) return;

    const initializeQRSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events/${eventId}/qr`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        const data = await response.json();
        if (response.ok) {
          setTokenQR(data.qr_token);
        }
      } catch (error) {
        console.error('Помилка ініціалізації QR:', error);
      }
    };

    const fetchNewToken = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events/${eventId}/qr`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setTokenQR(data.qr_token);

          Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
            Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          ]).start();
        }
      } catch (error) {
        console.error('Помилка оновлення токена:', error);
      }
    };

    initializeQRSession().then(() => {
      fetchAttendanceCount();
      intervalId = setInterval(() => {
        fetchNewToken();
        fetchAttendanceCount();
      }, ROTATION_INTERVAL * 1000);
    });

    return () => clearInterval(intervalId);
  }, [eventId, token]);

  const handleTokenRotation = React.useCallback(async () => {
  }, []);

  const attendedPct = totalStudents > 0 ? Math.round((scanned / totalStudents) * 100) : 0;

  return (
    <SafeAreaView style={s.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#12111A" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation?.goBack()}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>QR-код присутності</Text>
          <Text style={s.headerSub}>{courseTitle}</Text>
        </View>
      </View>

      <View style={s.body}>
        <View style={s.pills}>
          <View style={s.pill}>
            <Text style={s.pillText}>📋 {eventType}</Text>
          </View>
        </View>

        <Animated.View style={[s.qrWrap, { opacity: fadeAnim }]}>
          {token && tokenQR ? (
            <QRCode
              value={qrValue}
              size={220}
              backgroundColor="#F0EEF8"
              color="#12111A"
            />
          ) : (
            <View style={{ width: 220, height: 220, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#5B4CFA" style={{ marginBottom: 8 }} />
              <Text style={{ color: '#12111A', fontSize: 13, fontWeight: '500' }}>Генерація коду...</Text>
            </View>
          )}
        </Animated.View>
        <View style={s.countdownCard}>
          <CountdownRing onTrigger={handleTokenRotation} />
          <View style={s.countdownText}>
            <Text style={s.countdownTitle}>Автооновлення QR</Text>
            <Text style={s.countdownSub}>Код змінюється кожні {ROTATION_INTERVAL} сек</Text>
            <Text style={s.countdownSub}>Старий QR буде відхилено</Text>
          </View>
        </View>
        <View style={s.progressCard}>
          <View style={s.progressTop}>
            <Text style={s.progressTitle}>Відмітились</Text>
            <Text style={s.progressValue}>{scanned}/{totalStudents} · {attendedPct}%</Text>
          </View>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${attendedPct}%` as any }]} />
          </View>
          <Text style={s.progressSub}>
            {totalStudents > 0 && scanned === totalStudents
              ? '✅ Всі студенти відмітились!'
              : `⏳ Очікуємо ${Math.max(0, totalStudents - scanned)} студентів`}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#12111A' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#1C1B27', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#F0EEF8', fontSize: 18 },
  headerCenter: { flex: 1 },
  headerTitle: { color: '#F0EEF8', fontSize: 16, fontWeight: '700' },
  headerSub: { color: '#9896B0', fontSize: 11, marginTop: 1 },
  body: { flex: 1, padding: 20, gap: 14, alignItems: 'center' },
  pills: { flexDirection: 'row', justifyContent: 'center', gap: 8, alignSelf: 'stretch' },
  pill: { backgroundColor: '#1C1B27', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: '#F0EEF8', fontSize: 12, fontWeight: '600' },
  qrWrap: { backgroundColor: '#F0EEF8', padding: 12, borderRadius: 16, shadowColor: '#5B4CFA', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, marginVertical: 10 },
  countdownCard: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: '#1C1B27', borderRadius: 16, padding: 16, alignSelf: 'stretch' },
  countdownText: { gap: 3 },
  countdownTitle: { color: '#F0EEF8', fontSize: 13, fontWeight: '700' },
  countdownSub: { color: '#9896B0', fontSize: 11 },
  progressCard: { backgroundColor: '#1C1B27', borderRadius: 16, padding: 16, gap: 10, alignSelf: 'stretch' },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between' },
  progressTitle: { color: '#F0EEF8', fontSize: 13, fontWeight: '600' },
  progressValue: { color: '#23C97D', fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#23C97D', borderRadius: 4 },
  progressSub: { color: '#9896B0', fontSize: 11 },
});