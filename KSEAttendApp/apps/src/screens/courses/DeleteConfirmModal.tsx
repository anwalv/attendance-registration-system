import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableWithoutFeedback, TouchableOpacity } from 'react-native';

interface DeleteConfirmModalProps {
  courseTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteConfirmModal({ courseTitle, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableWithoutFeedback onPress={onCancel}>
        <View style={ds.overlay} />
      </TouchableWithoutFeedback>
      <View style={ds.deleteCard}>
        <Text style={ds.deleteIcon}>🗑️</Text>
        <Text style={ds.deleteTitle}>Видалити курс?</Text>
        <Text style={ds.deleteSub}>
          «{courseTitle}» буде видалено разом з усіма заняттями та даними відвідуваності. Цю дію неможливо скасувати.
        </Text>
        <View style={ds.btnRow}>
          <TouchableOpacity style={ds.cancelBtn} onPress={onCancel}>
            <Text style={ds.cancelBtnText}>Скасувати</Text>
          </TouchableOpacity>
          <TouchableOpacity style={ds.deleteBtn} onPress={onConfirm}>
            <Text style={ds.deleteBtnText}>Видалити</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const ds = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  deleteCard: { position: 'absolute', top: '35%', left: 24, right: 24, backgroundColor: '#1C1B27', borderRadius: 24, padding: 24, alignItems: 'center', gap: 10 },
  deleteIcon: { fontSize: 40, marginBottom: 4 },
  deleteTitle: { color: '#F0EEF8', fontSize: 18, fontWeight: '800' },
  deleteSub: { color: '#9896B0', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 8 },
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { color: '#9896B0', fontSize: 14, fontWeight: '600' },
  deleteBtn: { flex: 1, backgroundColor: 'rgba(244,72,94,0.15)', borderWidth: 1, borderColor: '#F4485E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteBtnText: { color: '#F4485E', fontSize: 14, fontWeight: '700' },
});