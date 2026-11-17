import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps, memo, useEffect, useState } from 'react';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { BookmarkIcon } from '@/components/atoms/BookmarkIcon';
import { ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { getArtworkUri, TitleArtwork } from '@/components/atoms/TitleArtwork';
import { getMetacriticScore, getTitleServices, MediaTitle } from '@/constants/catalog';
import { fetchTitleDuration, getCachedTitleDuration } from '@/services/tmdb';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

type MediaTitleCardProps = {
  title: MediaTitle;
  onOpen: () => void;
  actionIcon: MaterialIconName;
  actionLabel: string;
  onAction: () => void;
  actionButtonStyle?: StyleProp<ViewStyle>;
  actionIconColor?: string;
};

export const MediaTitleCard = memo(function MediaTitleCard({
  title,
  onOpen,
  actionIcon,
  actionLabel,
  onAction,
  actionButtonStyle,
  actionIconColor = '#657078',
}: MediaTitleCardProps) {
  const [resolvedDuration, setResolvedDuration] = useState<{ id: string; value: string } | null>(null);
  const cachedDuration = getCachedTitleDuration(title);
  const duration = resolvedDuration?.id === title.id ? resolvedDuration.value : cachedDuration;

  useEffect(() => {
    let active = true;
    void fetchTitleDuration(title).then((resolved) => {
      if (active) setResolvedDuration({ id: title.id, value: resolved });
    });
    return () => {
      active = false;
    };
  }, [title]);

  const hasArtwork = getArtworkUri(title.id, 'poster', {
    posterPath: title.tmdbPosterPath,
    backdropPath: title.tmdbBackdropPath,
  }) !== null;
  const metacritic = getMetacriticScore(title);

  return (
    <View style={styles.resultCard}>
      <Pressable
        style={({ pressed }) => [styles.poster, { backgroundColor: title.color }, pressed && styles.pressed]}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${title.title}`}>
        <TitleArtwork
          id={title.id}
          variant="poster"
          posterPath={title.tmdbPosterPath}
          backdropPath={title.tmdbBackdropPath}
        />
        {!hasArtwork && <MaterialIcons name={title.icon} size={25} color="rgba(255,255,255,0.9)" />}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.resultCopy, pressed && styles.pressed]}
        onPress={onOpen}
        accessibilityRole="button">
        <AppText peso="forte" style={styles.resultTitle} numberOfLines={2}>
          {title.title}
        </AppText>
        <AppText tipo="legenda" tabular style={styles.resultMeta}>
          {title.year || 'Ano não informado'} · {title.kind} · {duration}
        </AppText>
        <AppText tipo="legenda" style={styles.resultGenres} numberOfLines={1}>
          {title.genres.slice(0, 2).join(' · ')}
        </AppText>
        <View style={styles.serviceLine}>
          <ServiceLogoList services={getTitleServices(title)} size={20} maxVisible={3} gap={5} overflowGap={4} />
          <AppText tipo="legenda" peso="forte" tabular style={styles.scoreMeta}>
            TMDB {title.imdbRating}{metacritic !== null ? ` · MC ${metacritic}` : ''}
          </AppText>
        </View>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.actionButton, actionButtonStyle, pressed && styles.pressed]}
        onPress={onAction}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}>
        {actionIcon === 'bookmark' || actionIcon === 'bookmark-add' ? (
          <BookmarkIcon
            saved={actionIcon === 'bookmark'}
            itemKey={title.id}
            size={18}
            color={actionIconColor}
          />
        ) : (
          <MaterialIcons name={actionIcon} size={18} color={actionIconColor} />
        )}
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  resultCard: {
    minHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8e2d5',
    backgroundColor: '#fffdf8',
    marginBottom: 10,
  },
  poster: {
    width: 72,
    height: 92,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    overflow: 'hidden',
  },
  resultCopy: { flex: 1, paddingHorizontal: 12, paddingVertical: 4 },
  resultTitle: { color: '#182230', fontSize: 14.5, lineHeight: 19, marginBottom: 3 },
  resultMeta: { color: '#7b7b78', fontSize: 12, lineHeight: 17 },
  resultGenres: { color: '#8d7a61', fontSize: 12, lineHeight: 17, marginTop: 2 },
  serviceLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  scoreMeta: { color: '#657078', fontSize: 11, marginLeft: 4 },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1eee7',
  },
});
