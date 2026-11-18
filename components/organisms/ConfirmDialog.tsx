import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type ConfirmDialogProps = {
  visible: boolean;
  icon: MaterialIconName;
  eyebrow: string;
  title: string;
  message: string;
  confirmLabel: string;
  confirmIcon?: MaterialIconName;
  cancelLabel?: string;
  tone?: 'danger' | 'warning';
  inline?: boolean;
  cancelAccessibilityLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  visible,
  icon,
  eyebrow,
  title,
  message,
  confirmLabel,
  confirmIcon,
  cancelLabel = 'Cancelar',
  tone = 'danger',
  inline = false,
  cancelAccessibilityLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!visible) return null;
  const isWarning = tone === 'warning';

  const content = (
    <View style={inline ? styles.inlineBackdrop : styles.modalBackdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onCancel}
        accessibilityLabel={cancelAccessibilityLabel}
      />
      <View style={styles.card}>
        <View style={[styles.iconBadge, isWarning ? styles.iconBadgeWarning : styles.iconBadgeDanger]}>
          <MaterialIcons name={icon} size={24} color={isWarning ? '#d77c29' : '#c0392b'} />
        </View>
        <AppText tipo="legenda" peso="forte" style={[styles.eyebrow, isWarning && styles.eyebrowWarning]}>
          {eyebrow}
        </AppText>
        <AppText tipo="subtitulo" familia="editorial" peso="forte" style={styles.title}>
          {title}
        </AppText>
        <AppText tipo="legenda" style={styles.message}>
          {message}
        </AppText>
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.confirmButton,
              isWarning ? styles.confirmButtonWarning : styles.confirmButtonDanger,
              pressed && styles.pressed,
            ]}
            onPress={onConfirm}
            accessibilityRole="button">
            {confirmIcon && (
              <MaterialIcons name={confirmIcon} size={18} color={isWarning ? '#182230' : '#fffdf8'} />
            )}
            <AppText
              peso="forte"
              style={[styles.confirmText, isWarning ? styles.confirmTextWarning : styles.confirmTextDanger]}
              numberOfLines={1}>
              {confirmLabel}
            </AppText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            onPress={onCancel}
            accessibilityRole="button">
            <AppText peso="forte" style={styles.cancelText}>
              {cancelLabel}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );

  if (inline) return content;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      {content}
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  modalBackdrop: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,15,23,0.72)',
  },
  inlineBackdrop: {
    ...StyleSheet.absoluteFill,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,15,23,0.72)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: '#fffdf8',
    borderWidth: 1,
    borderColor: '#e8e2d5',
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconBadgeDanger: { backgroundColor: '#fdecea', borderColor: '#f5c6c2' },
  iconBadgeWarning: { backgroundColor: '#f6ebd4', borderColor: '#ebd9b3' },
  eyebrow: { color: '#c0392b', letterSpacing: 1.3, textAlign: 'center', marginBottom: 6 },
  eyebrowWarning: { color: '#e58c34' },
  title: {
    color: '#182230',
    fontSize: 21,
    lineHeight: 26,
    letterSpacing: -0.35,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    color: '#5e5c57',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: { width: '100%', gap: 10 },
  confirmButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  confirmButtonDanger: { backgroundColor: '#c0392b' },
  confirmButtonWarning: { backgroundColor: '#f3b43f' },
  confirmText: { fontSize: 14.5, textAlign: 'center' },
  confirmTextDanger: { color: '#fffdf8' },
  confirmTextWarning: { color: '#182230' },
  cancelButton: {
    width: '100%',
    minHeight: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#ded8cd',
    backgroundColor: '#f7f5f0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cancelText: { color: '#182230', fontSize: 14.5, textAlign: 'center' },
});
