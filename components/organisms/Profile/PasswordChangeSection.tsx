import { ActivityIndicator, View } from 'react-native';

import { AppButton } from '@/components/atoms/AppButton';
import { AppText } from '@/components/atoms/AppText';
import { PasswordInput } from '@/components/atoms/PasswordInput';
import { StatusFeedbackBanner } from '@/components/organisms/AuthStatusBanners';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { MIN_PASSWORD_LENGTH } from '@/types/auth';

type PasswordChangeSectionProps = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  currentPasswordError: string;
  newPasswordError: string;
  confirmPasswordError: string;
  passwordError: string;
  passwordSuccess: string;
  isSavingPassword: boolean;
  isConnected: boolean | null;
  onChangeCurrentPassword: (value: string) => void;
  onChangeNewPassword: (value: string) => void;
  onChangeConfirmPassword: (value: string) => void;
  onSubmit: () => void;
};

/** Seção de alteração de senha com validação local e feedback de sucesso/erro. */
export function PasswordChangeSection({
  currentPassword,
  newPassword,
  confirmPassword,
  currentPasswordError,
  newPasswordError,
  confirmPasswordError,
  passwordError,
  passwordSuccess,
  isSavingPassword,
  isConnected,
  onChangeCurrentPassword,
  onChangeNewPassword,
  onChangeConfirmPassword,
  onSubmit,
}: PasswordChangeSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <AppText tipo="legenda" peso="forte" style={styles.cardEyebrow}>
        SEGURANÇA
      </AppText>
      <AppText tipo="subtitulo" peso="forte" style={styles.cardTitle}>
        Alterar senha
      </AppText>
      <AppText tipo="legenda" style={styles.cardSubtitle}>
        Confirme sua senha atual para definir uma nova senha com letras e números.
      </AppText>

      <PasswordInput
        rotulo="Senha atual"
        placeholder="Digite sua senha atual"
        value={currentPassword}
        onChangeText={onChangeCurrentPassword}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="next"
        editable={!isSavingPassword}
        erro={currentPasswordError}
      />

      <PasswordInput
        rotulo="Nova senha"
        placeholder="Digite a nova senha"
        helperText={`Mínimo de ${MIN_PASSWORD_LENGTH} caracteres com letras e números`}
        value={newPassword}
        onChangeText={onChangeNewPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        editable={!isSavingPassword}
        erro={newPasswordError}
      />

      <PasswordInput
        rotulo="Confirmar nova senha"
        placeholder="Repita a nova senha"
        value={confirmPassword}
        onChangeText={onChangeConfirmPassword}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        editable={!isSavingPassword}
        onSubmitEditing={onSubmit}
        erro={confirmPasswordError}
      />

      {passwordError ? (
        <StatusFeedbackBanner
          tone="error"
          message={passwordError}
          style={styles.feedbackSpacing}
        />
      ) : null}
      {passwordSuccess ? (
        <StatusFeedbackBanner
          tone="success"
          message={passwordSuccess}
          style={styles.feedbackSpacing}
        />
      ) : null}

      <AppButton
        titulo={isSavingPassword ? 'Atualizando senha…' : 'Atualizar senha'}
        onPress={onSubmit}
        disabled={
          isSavingPassword ||
          isConnected === false ||
          (!currentPassword && !newPassword && !confirmPassword)
        }
        estilo={styles.primaryBtn}
      />

      {isSavingPassword && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accentLink} />
          <AppText tipo="legenda" style={styles.loadingText}>
            Validando credenciais e atualizando senha…
          </AppText>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  card: {
    backgroundColor: theme.colors.bgSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    padding: 20,
  },
  cardEyebrow: {
    color: theme.colors.accentLink,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  cardTitle: {
    color: theme.colors.textPrimary,
    fontSize: 19,
    lineHeight: 24,
    marginBottom: 4,
  },
  cardSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  feedbackSpacing: {
    marginBottom: 14,
  },
  primaryBtn: {
    borderRadius: 14,
    marginTop: 2,
  },
  loadingRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
});
