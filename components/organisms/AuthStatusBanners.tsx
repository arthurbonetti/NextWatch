import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { type AuthStatus } from '@/types/auth';

type AuthStatusBannersProps = {
  isConnected: boolean | null;
  offlineMessage: string;
  status: AuthStatus;
  errorMessage: string | null;
  errorTitle: string;
  onRetry: () => void;
};

export function AuthStatusBanners({
  isConnected,
  offlineMessage,
  status,
  errorMessage,
  errorTitle,
  onRetry,
}: AuthStatusBannersProps) {
  return (
    <>
      {isConnected === false && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="wifi-off" size={18} color="#9a5b20" />
          <AppText tipo="legenda" style={styles.offlineText}>
            {offlineMessage}
          </AppText>
        </View>
      )}

      {status === 'error' && errorMessage && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={18} color="#c0392b" />
          <View style={styles.errorCopy}>
            <AppText tipo="legenda" peso="forte" style={styles.errorTitle}>{errorTitle}</AppText>
            <AppText tipo="legenda" style={styles.errorText}>{errorMessage}</AppText>
          </View>
          <Pressable
            onPress={onRetry}
            hitSlop={8}
            style={({ pressed }) => [styles.retryChip, pressed && styles.pressed]}
            accessibilityRole="button">
            <AppText tipo="legenda" peso="forte" style={styles.retryText}>Repetir</AppText>
          </Pressable>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.84 },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f5e6c8',
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  offlineText: { flex: 1, color: '#625a4c' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fdecea',
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: '#c0392b', marginBottom: 2 },
  errorText: { color: '#7a271f' },
  retryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f9d7d3',
  },
  retryText: { color: '#962318', fontSize: 11 },
});
