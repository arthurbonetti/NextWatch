import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { Theme } from '@/constants/theme';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { type CastMember } from '@/types/media';
import { tmdbImageUri } from '@/utils/tmdbImage';

type CastCarouselProps = {
  cast: CastMember[];
};

export function CastCarousel({ cast }: CastCarouselProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (cast.length === 0) {
    return null;
  }

  return (
    <View style={styles.section}>
      <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
        Elenco principal
      </AppText>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {cast.map((member) => {
          const photoUri = member.profilePath ? tmdbImageUri(member.profilePath, 'w154') : null;
          return (
            <View key={member.id} style={styles.card}>
              <View style={styles.avatarCircle}>
                {photoUri ? (
                  <Image
                    source={{ uri: photoUri }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    transition={180}
                    cachePolicy="memory-disk"
                    accessibilityLabel={member.name}
                  />
                ) : (
                  <MaterialIcons name="person" size={28} color={colors.textMuted} />
                )}
              </View>
              <AppText tipo="legenda" peso="forte" style={styles.actorName} numberOfLines={2}>
                {member.name}
              </AppText>
              {member.character.length > 0 && (
                <AppText tipo="legenda" style={styles.characterName} numberOfLines={1}>
                  {member.character}
                </AppText>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  section: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
  },
  scrollContent: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  card: {
    width: 88,
    alignItems: 'center' as const,
    gap: 4,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: theme.colors.bgSurfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    overflow: 'hidden' as const,
    marginBottom: 2,
  },
  avatarImage: {
    width: '100%' as const,
    height: '100%' as const,
  },
  actorName: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center' as const,
  },
  characterName: {
    color: theme.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center' as const,
  },
});
