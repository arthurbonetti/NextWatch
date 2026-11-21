import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <>
      {isConnected === false && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="wifi-off" size={18} color={colors.accentLink} />
          <AppText tipo="legenda" style={styles.offlineText}>
            {offlineMessage}
          </AppText>
        </View>
      )}

      {status === 'error' && errorMessage && (
        <View style={styles.errorBanner}>
          <MaterialIcons name="error-outline" size={18} color={colors.dangerText} />
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

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.84 },
  offlineBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.colors.bgWarning,
    borderWidth: 1,
    borderColor: theme.colors.borderWarning,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  offlineText: { flex: 1, color: theme.colors.textWarm },
  errorBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.colors.dangerIconBg,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: 14,
    padding: 12,
    marginBottom: 18,
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: theme.colors.dangerText, marginBottom: 2 },
  errorText: { color: theme.colors.textPrimary },
  retryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.isDark ? theme.colors.bgSurface : theme.colors.borderDanger,
  },
  retryText: { color: theme.colors.dangerText, fontSize: 11 },
});
