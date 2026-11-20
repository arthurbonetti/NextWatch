import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { THEME } from '@/constants/theme';
import { type CastMember } from '@/types/media';
import { tmdbImageUri } from '@/utils/tmdbImage';

type CastCarouselProps = {
  cast: CastMember[];
};

export function CastCarousel({ cast }: CastCarouselProps) {
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
                  <MaterialIcons name="person" size={28} color={THEME.colors.textMuted} />
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

const styles = StyleSheet.create({
  section: {
    gap: THEME.spacing.sm,
  },
  sectionTitle: {
    color: THEME.colors.textPrimary,
    fontSize: 16,
  },
  scrollContent: {
    gap: THEME.spacing.md,
    paddingRight: THEME.spacing.lg,
  },
  card: {
    width: 88,
    alignItems: 'center',
    gap: 4,
  },
  avatarCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: THEME.colors.bgSubtle,
    borderWidth: 1,
    borderColor: THEME.colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 2,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  actorName: {
    color: THEME.colors.textPrimary,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },
  characterName: {
    color: THEME.colors.textMuted,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});
