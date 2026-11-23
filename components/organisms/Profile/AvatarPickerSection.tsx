import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppIcon } from '@/components/atoms/AppIcon';
import { AppText } from '@/components/atoms/AppText';
import { UserAvatar } from '@/components/atoms/UserAvatar';
import {
  AVATAR_PRESETS,
  type AvatarPresetId,
  type AvatarType,
  getAvatarPresetById,
  getAvatarPresetSource,
} from '@/constants/avatars';
import { Theme, withAlpha } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';

type AvatarPickerSectionProps = {
  displayName: string;
  avatarType: AvatarType;
  avatarPreset: AvatarPresetId | null;
  previewAvatarUrl: string | null;
  isPickingImage: boolean;
  isSavingProfile: boolean;
  pickerError: string;
  onPickImage: () => void;
  onUseInitials: () => void;
  onSelectPreset: (presetId: AvatarPresetId) => void;
};

/** Seção de escolha de foto da galeria, inicial do nome ou ícones cinematográficos do perfil. */
export function AvatarPickerSection({
  displayName,
  avatarType,
  avatarPreset,
  previewAvatarUrl,
  isPickingImage,
  isSavingProfile,
  pickerError,
  onPickImage,
  onUseInitials,
  onSelectPreset,
}: AvatarPickerSectionProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const activePreset = avatarType === 'preset' ? getAvatarPresetById(avatarPreset) : null;

  return (
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
          name={displayName}
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
          onPress={onPickImage}
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
          onPress={onUseInitials}
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
          const innerSize = selected ? 58 : 61;
          return (
            <Pressable
              key={preset.id}
              onPress={() => onSelectPreset(preset.id)}
              disabled={isSavingProfile}
              style={({ pressed }) => [styles.presetTile, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Selecionar ícone ${preset.label}`}>
              <View style={styles.presetAvatarWrap}>
                <View
                  style={[
                    styles.presetCircle,
                    {
                      borderColor: selected ? colors.accentPrimary : colors.borderSubtle,
                      borderWidth: selected ? 3 : 1.5,
                    },
                  ]}>
                  <Image
                    source={getAvatarPresetSource(preset, innerSize)}
                    style={styles.presetImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    allowDownscaling={false}
                    accessible={false}
                  />
                </View>
                {selected && (
                  <View style={styles.presetCheckBadge}>
                    <AppIcon name="check" size={12} color={colors.textOnAccent} />
                  </View>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabledControl: {
    opacity: 0.55,
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
    width: 72,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: 4,
  },
  presetAvatarWrap: {
    width: 64,
    height: 64,
    position: 'relative' as const,
  },
  presetCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.avatarBg,
  },
  presetImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  presetCheckBadge: {
    position: 'absolute' as const,
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.accentPrimary,
    borderWidth: 2,
    borderColor: theme.colors.bgSurface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});
