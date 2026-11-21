import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/atoms/AppButton';
import { AppInput } from '@/components/atoms/AppInput';
import { AppText } from '@/components/atoms/AppText';
import { BackButton } from '@/components/atoms/BackButton';
import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import {
  AVATAR_PRESETS,
  type AvatarPresetId,
  type AvatarType,
  getAvatarPresetById,
} from '@/constants/avatars';
import { Theme, withAlpha } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import {
  isStrongPassword,
  MAX_NAME_LENGTH,
  MIN_LOGIN_PASSWORD_LENGTH,
  MIN_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  type PendingAvatarUpload,
} from '@/types/auth';
import { decodeBase64ToBytes, validateAvatarBytes } from '@/utils/avatarImage';
import { triggerSelectionHaptic } from '@/utils/haptics';

type FeedbackBannerProps = {
  tone: 'error' | 'success';
  message: string;
};

function FeedbackBanner({ tone, message }: FeedbackBannerProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const isSuccess = tone === 'success';

  return (
    <View style={[styles.feedbackBanner, isSuccess ? styles.successBanner : styles.errorBanner]}>
      <MaterialIcons
        name={isSuccess ? 'check-circle-outline' : 'error-outline'}
        size={18}
        color={isSuccess ? colors.successText : colors.dangerText}
      />
      <AppText
        tipo="legenda"
        peso="semiforte"
        style={[styles.feedbackText, isSuccess ? styles.successText : styles.errorText]}>
        {message}
      </AppText>
    </View>
  );
}

type ProfileSnapshot = {
  userId: string;
  name: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  avatarPath: string | null;
};

export default function EditProfileScreen() {
  const { user, authReady, isConnected, updateProfile, updatePassword } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [name, setName] = useState(user?.name ?? '');
  const [avatarType, setAvatarType] = useState<AvatarType>(user?.avatarType ?? 'initials');
  const [avatarPreset, setAvatarPreset] = useState<AvatarPresetId | null>(user?.avatarPreset ?? null);
  const [pendingUpload, setPendingUpload] = useState<PendingAvatarUpload | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const syncedSnapshotRef = useRef<ProfileSnapshot | null>(
    user
      ? {
          userId: user.id,
          name: user.name,
          avatarType: user.avatarType,
          avatarPreset: user.avatarPreset,
          avatarPath: user.avatarPath,
        }
      : null,
  );

  useEffect(() => {
    if (!user) {
      syncedSnapshotRef.current = null;
      return;
    }

    const prev = syncedSnapshotRef.current;
    const isDifferentUser = !prev || prev.userId !== user.id;
    const hasNoLocalEdits =
      prev !== null &&
      name === prev.name &&
      avatarType === prev.avatarType &&
      avatarPreset === prev.avatarPreset &&
      pendingUpload === null;

    if (isDifferentUser || hasNoLocalEdits) {
      setName(user.name);
      setAvatarType(user.avatarType);
      setAvatarPreset(user.avatarPreset);
      setPendingUpload(null);
      syncedSnapshotRef.current = {
        userId: user.id,
        name: user.name,
        avatarType: user.avatarType,
        avatarPreset: user.avatarPreset,
        avatarPath: user.avatarPath,
      };
    }
  }, [avatarPreset, avatarType, name, pendingUpload, user]);

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  const activePreset = avatarType === 'preset' ? getAvatarPresetById(avatarPreset) : null;
  const previewAvatarUrl = avatarType === 'custom' ? (pendingUpload?.uri ?? user.avatarUrl) : null;

  const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH);
  const hasProfileChanges =
    trimmedName !== user.name ||
    avatarType !== user.avatarType ||
    (avatarType === 'preset' && avatarPreset !== user.avatarPreset) ||
    (avatarType === 'custom' && pendingUpload !== null);

  const handleSelectPreset = (presetId: AvatarPresetId) => {
    triggerSelectionHaptic();
    setAvatarType('preset');
    setAvatarPreset(presetId);
    setPendingUpload(null);
    setPickerError('');
    setProfileError('');
  };

  const handleUseInitials = () => {
    triggerSelectionHaptic();
    setAvatarType('initials');
    setAvatarPreset(null);
    setPendingUpload(null);
    setPickerError('');
    setProfileError('');
  };

  const handlePickImage = async () => {
    if (isPickingImage || isSavingProfile) return;
    setPickerError('');
    setProfileError('');
    setIsPickingImage(true);

    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setPickerError(
            'Permita o acesso à galeria nas configurações do aparelho para enviar uma foto.',
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.82,
        exif: false,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        setPickerError('Não foi possível ler a imagem selecionada.');
        return;
      }

      let bytes: Uint8Array;
      if (typeof asset.base64 === 'string' && asset.base64.length > 0) {
        bytes = decodeBase64ToBytes(asset.base64);
      } else {
        const response = await fetch(asset.uri);
        const arrayBuffer = await response.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      }

      const validation = validateAvatarBytes(bytes);
      if (!validation.ok) {
        setPickerError(validation.error);
        return;
      }

      triggerSelectionHaptic();
      setPendingUpload({
        uri: asset.uri,
        bytes,
        contentType: validation.contentType,
        extension: validation.extension,
      });
      setAvatarType('custom');
      setAvatarPreset(null);
    } catch {
      setPickerError('Não foi possível carregar a imagem selecionada. Tente outra foto.');
    } finally {
      setIsPickingImage(false);
    }
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile || !hasProfileChanges) return;
    setProfileError('');

    if (trimmedName.length < MIN_NAME_LENGTH) {
      setNameError(`Informe seu nome (pelo menos ${MIN_NAME_LENGTH} caracteres).`);
      setProfileError(`Informe um nome válido (pelo menos ${MIN_NAME_LENGTH} caracteres).`);
      return;
    }
    setNameError('');

    setIsSavingProfile(true);
    try {
      await updateProfile({
        name: trimmedName,
        avatarType,
        avatarPreset: avatarType === 'preset' ? avatarPreset : null,
        pendingUpload: avatarType === 'custom' ? pendingUpload : null,
      });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/tab3');
      }
    } catch (error) {
      setProfileError(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar suas alterações. Tente novamente.',
      );
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (isSavingPassword) return;
    setPasswordError('');
    setPasswordSuccess('');

    const validCurrent = currentPassword.length >= MIN_LOGIN_PASSWORD_LENGTH;
    const validNew = isStrongPassword(newPassword);
    const isDifferent = validNew && newPassword !== currentPassword;
    const passwordsMatch = newPassword === confirmPassword;

    setCurrentPasswordError(validCurrent ? '' : 'Informe sua senha atual.');
    setNewPasswordError(
      !validNew
        ? `Use pelo menos ${MIN_PASSWORD_LENGTH} caracteres com letras e números.`
        : !isDifferent
          ? 'A nova senha deve ser diferente da senha atual.'
          : '',
    );
    setConfirmPasswordError(passwordsMatch ? '' : 'As senhas não coincidem.');

    if (!validCurrent || !validNew || !isDifferent || !passwordsMatch) {
      return;
    }

    setIsSavingPassword(true);
    try {
      await updatePassword({
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Senha atualizada com sucesso!');
    } catch (error) {
      setPasswordError(
        error instanceof Error
          ? error.message
          : 'Não foi possível atualizar sua senha. Tente novamente.',
      );
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          <FadeInBlock delay={0}>
            <View style={styles.header}>
              <BackButton fallbackHref="/(tabs)/tab3" />
              <View style={styles.headerCopy}>
                <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>
                  CONTA
                </AppText>
                <AppText tipo="titulo" peso="forte" style={styles.title}>
                  Editar perfil
                </AppText>
              </View>
            </View>
          </FadeInBlock>

          {isConnected === false && (
            <FadeInBlock delay={15}>
              <View style={styles.offlineBanner}>
                <MaterialIcons name="wifi-off" size={18} color={colors.accentLink} />
                <AppText tipo="legenda" style={styles.offlineText}>
                  Sem conexão com a internet. Conecte-se para salvar alterações no perfil ou na senha.
                </AppText>
              </View>
            </FadeInBlock>
          )}

          <FadeInBlock delay={35}>
            <View style={styles.card}>
              <AppText tipo="legenda" peso="forte" style={styles.cardEyebrow}>
                ÍCONE DO PERFIL
              </AppText>
              <AppText tipo="subtitulo" peso="forte" style={styles.cardTitle}>
                Foto e avatares
              </AppText>
              <AppText tipo="legenda" style={styles.cardSubtitle}>
                Escolha um ícone cinematográfico exclusivo ou envie uma foto da sua galeria.
              </AppText>

              <View style={styles.previewArea}>
                <UserAvatar
                  size={104}
                  name={name || user.name}
                  avatarType={avatarType}
                  avatarPreset={avatarPreset}
                  avatarUrl={previewAvatarUrl}
                  borderWidth={3}
                  borderColor={activePreset?.accentColor ?? colors.avatarBorder}
                />
              </View>

              <View style={styles.avatarActionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.avatarActionBtn,
                    styles.avatarActionUpload,
                    (isPickingImage || isSavingProfile) && styles.disabledControl,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    void handlePickImage();
                  }}
                  disabled={isPickingImage || isSavingProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Enviar foto da galeria">
                  {isPickingImage ? (
                    <ActivityIndicator size="small" color={colors.accentLink} />
                  ) : (
                    <MaterialIcons name="photo-library" size={18} color={colors.accentLink} />
                  )}
                  <AppText tipo="legenda" peso="forte" style={styles.avatarActionUploadText}>
                    {isPickingImage ? 'Abrindo…' : 'Enviar foto'}
                  </AppText>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.avatarActionBtn,
                    avatarType === 'initials' && styles.avatarActionActive,
                    isSavingProfile && styles.disabledControl,
                    pressed && styles.pressed,
                  ]}
                  onPress={handleUseInitials}
                  disabled={isSavingProfile}
                  accessibilityRole="button"
                  accessibilityLabel="Usar inicial do nome como ícone">
                  <MaterialIcons
                    name="person-outline"
                    size={18}
                    color={avatarType === 'initials' ? colors.accentLink : colors.textSecondary}
                  />
                  <AppText
                    tipo="legenda"
                    peso="forte"
                    style={
                      avatarType === 'initials'
                        ? styles.avatarActionTextActive
                        : styles.avatarActionText
                    }>
                    Usar inicial
                  </AppText>
                </Pressable>
              </View>

              {pickerError ? (
                <AppText tipo="legenda" peso="medio" style={styles.pickerErrorText}>
                  {pickerError}
                </AppText>
              ) : null}

              <View style={styles.presetsHeader}>
                <AppText tipo="legenda" peso="forte" style={styles.presetsLabel}>
                  ÍCONES CINEMATOGRÁFICOS
                </AppText>
                <AppText tipo="legenda" style={styles.presetsHint}>
                  {AVATAR_PRESETS.length} estilos exclusivos
                </AppText>
              </View>

              <View style={styles.presetsGrid}>
                {AVATAR_PRESETS.map((preset) => {
                  const selected = avatarType === 'preset' && avatarPreset === preset.id;
                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => handleSelectPreset(preset.id)}
                      disabled={isSavingProfile}
                      style={({ pressed }) => [
                        styles.presetTile,
                        selected && styles.presetTileSelected,
                        pressed && styles.pressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Selecionar ícone ${preset.label}`}>
                      <View
                        style={[
                          styles.presetCircle,
                          {
                            borderColor: selected ? colors.accentPrimary : colors.borderSubtle,
                            borderWidth: selected ? 3 : 1.5,
                          },
                        ]}>
                        <Image
                          source={preset.source}
                          style={styles.presetImage}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          accessible={false}
                        />
                        {selected && (
                          <View style={styles.presetCheckBadge}>
                            <MaterialIcons name="check" size={12} color={colors.textOnAccent} />
                          </View>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </FadeInBlock>

          <FadeInBlock delay={70}>
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
                onChangeText={(value) => {
                  setName(value);
                  setNameError('');
                  setProfileError('');
                }}
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
                  <MaterialIcons name="lock-outline" size={18} color={colors.textMuted} />
                  <AppText
                    tipo="texto"
                    selectable
                    numberOfLines={1}
                    style={styles.readOnlyValue}>
                    {user.email}
                  </AppText>
                </View>
                <AppText tipo="legenda" style={styles.readOnlyHint}>
                  O e-mail da conta não pode ser alterado.
                </AppText>
              </View>
            </View>
          </FadeInBlock>

          <FadeInBlock delay={105}>
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

              <AppInput
                rotulo="Senha atual"
                placeholder="Digite sua senha atual"
                value={currentPassword}
                onChangeText={(value) => {
                  setCurrentPassword(value);
                  setCurrentPasswordError('');
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                secureTextEntry
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="next"
                editable={!isSavingPassword}
                erro={currentPasswordError}
              />

              <AppInput
                rotulo="Nova senha"
                placeholder={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres (letras e números)`}
                value={newPassword}
                onChangeText={(value) => {
                  setNewPassword(value);
                  setNewPasswordError('');
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                editable={!isSavingPassword}
                erro={newPasswordError}
              />

              <AppInput
                rotulo="Confirmar nova senha"
                placeholder="Digite a nova senha novamente"
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setConfirmPasswordError('');
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                editable={!isSavingPassword}
                onSubmitEditing={() => {
                  void handleUpdatePassword();
                }}
                erro={confirmPasswordError}
              />

              {passwordError ? <FeedbackBanner tone="error" message={passwordError} /> : null}
              {passwordSuccess ? <FeedbackBanner tone="success" message={passwordSuccess} /> : null}

              <AppButton
                titulo={isSavingPassword ? 'Atualizando senha…' : 'Atualizar senha'}
                onPress={() => {
                  void handleUpdatePassword();
                }}
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
          </FadeInBlock>
        </ScrollView>

        {(hasProfileChanges || isSavingProfile || Boolean(profileError)) && (
          <View style={styles.saveFooter}>
            <View style={styles.saveFooterInner}>
              {profileError ? <FeedbackBanner tone="error" message={profileError} /> : null}
              <AppButton
                titulo={isSavingProfile ? 'Salvando…' : 'Salvar alterações'}
                onPress={() => {
                  void handleSaveProfile();
                }}
                disabled={!hasProfileChanges || isSavingProfile || isConnected === false}
                estilo={styles.primaryBtn}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) => ({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  keyboardView: {
    flex: 1,
  },
  container: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 42,
    gap: 16,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabledControl: {
    opacity: 0.55,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 4,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: theme.colors.accentLink,
    letterSpacing: 1.5,
    marginBottom: 3,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  offlineBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: theme.colors.bgWarning,
    borderWidth: 1,
    borderColor: theme.colors.borderWarning,
    borderRadius: 14,
    padding: 12,
  },
  offlineText: {
    flex: 1,
    color: theme.colors.textWarm,
  },
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
  previewArea: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 4,
    marginBottom: 16,
  },
  avatarActionsRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginBottom: 12,
  },
  avatarActionBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  avatarActionUpload: {
    borderColor: withAlpha(theme.colors.accentPrimary, 0.45),
    backgroundColor: theme.colors.savedActiveBg,
  },
  avatarActionActive: {
    borderColor: theme.colors.accentLink,
    backgroundColor: theme.colors.bgHighlight,
  },
  avatarActionUploadText: {
    color: theme.colors.accentLink,
    fontSize: 13,
  },
  avatarActionText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
  },
  avatarActionTextActive: {
    color: theme.colors.accentLink,
    fontSize: 13,
  },
  pickerErrorText: {
    color: theme.colors.dangerText,
    marginBottom: 12,
  },
  presetsHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 6,
    marginBottom: 12,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
  },
  presetsLabel: {
    color: theme.colors.textSecondary,
    letterSpacing: 0.9,
  },
  presetsHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
  },
  presetsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'center' as const,
    gap: 10,
  },
  presetTile: {
    width: 76,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.transparent,
  },
  presetTileSelected: {
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderColor: theme.colors.borderSubtle,
  },
  presetCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.avatarBg,
    position: 'relative' as const,
  },
  presetImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  presetCheckBadge: {
    position: 'absolute' as const,
    right: 2,
    bottom: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.accentPrimary,
    borderWidth: 2,
    borderColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
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
    opacity: 0.78,
  },
  readOnlyValue: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 15,
  },
  readOnlyHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  feedbackBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  errorBanner: {
    backgroundColor: theme.colors.dangerIconBg,
    borderColor: theme.colors.dangerBorder,
  },
  successBanner: {
    backgroundColor: theme.colors.bgSuccess,
    borderColor: theme.colors.borderSuccess,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: theme.colors.dangerText,
  },
  successText: {
    color: theme.colors.successText,
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
  saveFooter: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSubtle,
    backgroundColor: theme.colors.bgSurface,
  },
  saveFooterInner: {
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
});
