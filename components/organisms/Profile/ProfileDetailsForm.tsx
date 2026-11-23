import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, View } from 'react-native';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { StatusFeedbackBanner } from '@/components/organisms/AuthStatusBanners';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { MAX_NAME_LENGTH } from '@/types/auth';

type ProfileDetailsFormProps = {
  name: string;
  email: string;
  nameError: string;
  profileError: string;
  profileSuccess: string;
  hasProfileChanges: boolean;
  isSavingProfile: boolean;
  isConnected: boolean | null;
  onChangeName: (value: string) => void;
  onSaveProfile: () => void;
};

/** Formulário de identificação do perfil (nome editável, e-mail somente leitura e ação de salvar). */
export function ProfileDetailsForm({
  name,
  email,
  nameError,
  profileError,
  profileSuccess,
  hasProfileChanges,
  isSavingProfile,
  isConnected,
  onChangeName,
  onSaveProfile,
}: ProfileDetailsFormProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <AppText tipo="legenda" peso="forte" style={styles.cardEyebrow}>
        DADOS DA CONTA
      </AppText>
      <AppText tipo="subtitulo" peso="forte" style={styles.cardTitle}>
        Identificação
      </AppText>

      <AppInput
        rotulo="Nome"
        placeholder="Como podemos chamar você?"
        value={name}
        onChangeText={onChangeName}
        maxLength={MAX_NAME_LENGTH}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        editable={!isSavingProfile}
        erro={nameError}
      />

      <View style={styles.readOnlyField}>
        <AppText tipo="legenda" peso="semiforte" style={styles.readOnlyLabel}>
          E-mail
        </AppText>
        <View style={styles.readOnlyBox}>
          <MaterialIcons name="lock-outline" size={18} color={colors.textSecondary} />
          <AppText tipo="texto" selectable numberOfLines={1} style={styles.readOnlyValue}>
            {email}
          </AppText>
        </View>
        <AppText tipo="legenda" style={styles.readOnlyHint}>
          O e-mail da conta não pode ser alterado.
        </AppText>
      </View>

      {profileError ? (
        <StatusFeedbackBanner tone="error" message={profileError} style={styles.feedbackSpacing} />
      ) : null}
      {profileSuccess ? (
        <StatusFeedbackBanner
          tone="success"
          message={profileSuccess}
          style={styles.feedbackSpacing}
        />
      ) : null}

      <AppButton
        titulo={isSavingProfile ? 'Salvando perfil…' : 'Salvar alterações do perfil'}
        onPress={onSaveProfile}
        disabled={!hasProfileChanges || isSavingProfile || isConnected === false}
        estilo={styles.primaryBtn}
      />

      {isSavingProfile && (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={colors.accentLink} />
          <AppText tipo="legenda" style={styles.loadingText}>
            Salvando foto e dados do perfil…
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
  readOnlyField: {
    marginBottom: 16,
  },
  readOnlyLabel: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 7,
  },
  readOnlyBox: {
    minHeight: 50,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderRadius: 14,
    paddingHorizontal: 15,
  },
  readOnlyValue: {
    flex: 1,
    color: theme.colors.textStrongBody,
    fontSize: 15,
  },
  readOnlyHint: {
    color: theme.colors.textHint,
    fontSize: 12,
    marginTop: 6,
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
