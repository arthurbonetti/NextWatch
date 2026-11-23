import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, type StyleProp, View, type ViewStyle } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { type AuthStatus } from '@/types/auth';

export type StatusFeedbackBannerProps = {
  tone: 'error' | 'success' | 'warning';
  message: string;
  title?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** Banner reutilizável de feedback (erro, sucesso ou aviso offline) para telas de autenticação e perfil. */
export function StatusFeedbackBanner({
  tone,
  message,
  title,
  onRetry,
  style,
}: StatusFeedbackBannerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const iconName =
    tone === 'success'
      ? 'check-circle-outline'
      : tone === 'warning'
        ? 'wifi-off'
        : 'error-outline';
  const iconColor =
    tone === 'success'
      ? colors.successText
      : tone === 'warning'
        ? colors.accentLink
        : colors.dangerText;
  const containerToneStyle =
    tone === 'success'
      ? styles.successBanner
      : tone === 'warning'
        ? styles.offlineBanner
        : styles.errorBanner;
  const textToneStyle =
    tone === 'success'
      ? styles.successText
      : tone === 'warning'
        ? styles.offlineText
        : title
          ? styles.errorTextWithTitle
          : styles.errorText;

  return (
    <View style={[styles.bannerBase, containerToneStyle, style]}>
      <MaterialIcons name={iconName} size={18} color={iconColor} />
      {title ? (
        <View style={styles.copy}>
          <AppText tipo="legenda" peso="forte" style={styles.errorTitle}>
            {title}
          </AppText>
          <AppText tipo="legenda" style={textToneStyle}>
            {message}
          </AppText>
        </View>
      ) : (
        <AppText
          tipo="legenda"
          peso={tone === 'warning' ? 'normal' : 'semiforte'}
          style={[styles.feedbackText, textToneStyle]}>
          {message}
        </AppText>
      )}
      {onRetry && (
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          style={({ pressed }) => [styles.retryChip, pressed && styles.pressed]}
          accessibilityRole="button">
          <AppText tipo="legenda" peso="forte" style={styles.retryText}>
            Repetir
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

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
  const styles = useThemedStyles(createStyles);

  return (
    <>
      {isConnected === false && (
        <StatusFeedbackBanner
          tone="warning"
          message={offlineMessage}
          style={styles.authOfflineSpacing}
        />
      )}

      {status === 'error' && errorMessage && (
        <StatusFeedbackBanner
          tone="error"
          title={errorTitle}
          message={errorMessage}
          onRetry={onRetry}
          style={styles.authErrorSpacing}
        />
      )}
    </>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: { opacity: 0.84 },
  bannerBase: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  offlineBanner: {
    backgroundColor: theme.colors.bgWarning,
    borderColor: theme.colors.borderWarning,
  },
  errorBanner: {
    backgroundColor: theme.colors.dangerIconBg,
    borderColor: theme.colors.dangerBorder,
  },
  successBanner: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  authOfflineSpacing: {
    marginBottom: 14,
  },
  authErrorSpacing: {
    marginBottom: 18,
  },
  copy: { flex: 1 },
  feedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },
  offlineText: { flex: 1, color: theme.colors.textWarm },
  errorTitle: { color: theme.colors.dangerText, marginBottom: 2 },
  errorText: { color: theme.colors.dangerText },
  errorTextWithTitle: { color: theme.colors.textPrimary },
  successText: { color: theme.colors.successText },
  retryChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: theme.isDark ? theme.colors.bgSurface : theme.colors.borderDanger,
  },
  retryText: { color: theme.colors.dangerText, fontSize: 11 },
});
