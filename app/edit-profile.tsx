import * as ImagePicker from 'expo-image-picker';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FadeInBlock } from '@/components/atoms/FadeInBlock';
import { StatusFeedbackBanner } from '@/components/organisms/AuthStatusBanners';
import { AvatarPickerSection } from '@/components/organisms/Profile/AvatarPickerSection';
import { PasswordChangeSection } from '@/components/organisms/Profile/PasswordChangeSection';
import { ProfileDetailsForm } from '@/components/organisms/Profile/ProfileDetailsForm';
import { ScreenHeader } from '@/components/organisms/ScreenHeader';
import type { AvatarPresetId, AvatarType } from '@/constants/avatars';
import { Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useThemedStyles } from '@/contexts/ThemeContext';
import { useProfile } from '@/hooks/useProfile';
import {
  isStrongPassword,
  MAX_NAME_LENGTH,
  MIN_LOGIN_PASSWORD_LENGTH,
  MIN_NAME_LENGTH,
  MIN_PASSWORD_LENGTH,
  type PendingAvatarUpload,
} from '@/types/auth';
import { triggerSelectionHaptic } from '@/utils/haptics';

type ProfileSnapshot = {
  userId: string;
  name: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  avatarPath: string | null;
};

export default function EditProfileScreen() {
  const { user, authReady, isPasswordRecovery, isConnected, updatePassword } = useAuth();
  const { profile, updateProfile, prepareAvatarUpload } = useProfile();
  const styles = useThemedStyles(createStyles);

  const [name, setName] = useState(profile?.name ?? user?.name ?? '');
  const [avatarType, setAvatarType] = useState<AvatarType>(profile?.avatarType ?? 'initials');
  const [avatarPreset, setAvatarPreset] = useState<AvatarPresetId | null>(profile?.avatarPreset ?? null);
  const [pendingUpload, setPendingUpload] = useState<PendingAvatarUpload | null>(null);
  const [isPickingImage, setIsPickingImage] = useState(false);
  const [pickerError, setPickerError] = useState('');
  const [nameError, setNameError] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [scrolled, setScrolled] = useState(false);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 6;
    setScrolled((prev) => (prev === isScrolled ? prev : isScrolled));
  }, []);

  const syncedSnapshotRef = useRef<ProfileSnapshot | null>(
    profile
      ? {
          userId: profile.userId,
          name: profile.name,
          avatarType: profile.avatarType,
          avatarPreset: profile.avatarPreset,
          avatarPath: profile.avatarPath,
        }
      : null,
  );

  useEffect(() => {
    if (!profile) {
      syncedSnapshotRef.current = null;
      return;
    }

    const prev = syncedSnapshotRef.current;
    const isDifferentUser = !prev || prev.userId !== profile.userId;
    const hasNoLocalEdits =
      prev !== null &&
      name === prev.name &&
      avatarType === prev.avatarType &&
      avatarPreset === prev.avatarPreset &&
      pendingUpload === null;

    if (isDifferentUser || hasNoLocalEdits) {
      setName(profile.name);
      setAvatarType(profile.avatarType);
      setAvatarPreset(profile.avatarPreset);
      setPendingUpload(null);
      syncedSnapshotRef.current = {
        userId: profile.userId,
        name: profile.name,
        avatarType: profile.avatarType,
        avatarPreset: profile.avatarPreset,
        avatarPath: profile.avatarPath,
      };
    }
  }, [avatarPreset, avatarType, name, pendingUpload, profile]);

  if (!authReady) return null;
  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (!user) return <Redirect href="/(auth)/login" />;

  const currentProfileName = profile?.name ?? user.name;
  const currentAvatarType = profile?.avatarType ?? 'initials';
  const currentAvatarPreset = profile?.avatarPreset ?? null;
  const currentAvatarUrl = profile?.avatarUrl ?? null;

  const previewAvatarUrl = avatarType === 'custom' ? (pendingUpload?.uri ?? currentAvatarUrl) : null;

  const trimmedName = name.trim().slice(0, MAX_NAME_LENGTH);
  const hasProfileChanges =
    trimmedName !== currentProfileName ||
    avatarType !== currentAvatarType ||
    (avatarType === 'preset' && avatarPreset !== currentAvatarPreset) ||
    (avatarType === 'custom' && pendingUpload !== null);

  const handleSelectPreset = (presetId: AvatarPresetId) => {
    triggerSelectionHaptic();
    setAvatarType('preset');
    setAvatarPreset(presetId);
    setPendingUpload(null);
    setPickerError('');
    setProfileError('');
    setProfileSuccess('');
  };

  const handleUseInitials = () => {
    triggerSelectionHaptic();
    setAvatarType('initials');
    setAvatarPreset(null);
    setPendingUpload(null);
    setPickerError('');
    setProfileError('');
    setProfileSuccess('');
  };

  const handlePickImage = async () => {
    if (isPickingImage || isSavingProfile) return;
    setPickerError('');
    setProfileError('');
    setProfileSuccess('');
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
        quality: 0.9,
        exif: false,
        base64: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const prepared = await prepareAvatarUpload(result.assets[0]);
      if (!prepared.ok) {
        setPickerError(prepared.error);
        return;
      }

      triggerSelectionHaptic();
      setPendingUpload(prepared.upload);
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
    setProfileSuccess('');

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
      setPendingUpload(null);
      setProfileSuccess('Alterações do perfil salvas!');
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
      <ScreenHeader
        eyebrow="CONTA"
        title="Editar perfil"
        showBack
        fallbackHref="/(tabs)/profile"
        scrolled={scrolled}
      />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}>
          {isConnected === false && (
            <FadeInBlock delay={15}>
              <StatusFeedbackBanner
                tone="warning"
                message="Sem conexão com a internet. Conecte-se para salvar alterações no perfil ou na senha."
              />
            </FadeInBlock>
          )}

          <FadeInBlock delay={35}>
            <AvatarPickerSection
              displayName={name || currentProfileName}
              avatarType={avatarType}
              avatarPreset={avatarPreset}
              previewAvatarUrl={previewAvatarUrl}
              isPickingImage={isPickingImage}
              isSavingProfile={isSavingProfile}
              pickerError={pickerError}
              onPickImage={() => {
                void handlePickImage();
              }}
              onUseInitials={handleUseInitials}
              onSelectPreset={handleSelectPreset}
            />
          </FadeInBlock>

          <FadeInBlock delay={70}>
            <ProfileDetailsForm
              name={name}
              email={user.email}
              nameError={nameError}
              profileError={profileError}
              profileSuccess={profileSuccess}
              hasProfileChanges={hasProfileChanges}
              isSavingProfile={isSavingProfile}
              isConnected={isConnected}
              onChangeName={(value) => {
                setName(value);
                setNameError('');
                setProfileError('');
                setProfileSuccess('');
              }}
              onSaveProfile={() => {
                void handleSaveProfile();
              }}
            />
          </FadeInBlock>

          <FadeInBlock delay={105}>
            <PasswordChangeSection
              currentPassword={currentPassword}
              newPassword={newPassword}
              confirmPassword={confirmPassword}
              currentPasswordError={currentPasswordError}
              newPasswordError={newPasswordError}
              confirmPasswordError={confirmPasswordError}
              passwordError={passwordError}
              passwordSuccess={passwordSuccess}
              isSavingPassword={isSavingPassword}
              isConnected={isConnected}
              onChangeCurrentPassword={(value) => {
                setCurrentPassword(value);
                setCurrentPasswordError('');
                setPasswordError('');
                setPasswordSuccess('');
              }}
              onChangeNewPassword={(value) => {
                setNewPassword(value);
                setNewPasswordError('');
                setPasswordError('');
                setPasswordSuccess('');
              }}
              onChangeConfirmPassword={(value) => {
                setConfirmPassword(value);
                setConfirmPasswordError('');
                setPasswordError('');
                setPasswordSuccess('');
              }}
              onSubmit={() => {
                void handleUpdatePassword();
              }}
            />
          </FadeInBlock>
        </ScrollView>
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
    paddingTop: 10,
    paddingBottom: 42,
    gap: 16,
  },
});
