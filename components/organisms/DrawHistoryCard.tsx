import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ComponentProps, memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { TitleArtwork } from '@/components/atoms/TitleArtwork';
import { MediaTitle } from '@/constants/catalog';
import { DrawAction, DrawHistoryEntry } from '@/contexts/DrawHistoryContext';
import { formatShortDateTime } from '@/utils/format';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

const ACTION_META: Record<DrawAction, { label: string; icon: MaterialIconName; bg: string; color: string }> = {
  assistiu: { label: 'Assistiu', icon: 'check-circle', bg: '#e5efe7', color: '#216941' },
  salvou: { label: 'Salvou', icon: 'bookmark', bg: '#fff2d8', color: '#944c0d' },
  'sorteou outro': { label: 'Sorteou outro', icon: 'casino', bg: '#f1e8d7', color: '#8b5827' },
  ignorou: { label: 'Ignorou', icon: 'close', bg: '#f1eee7', color: '#5e5c57' },
};

type DrawHistoryCardProps = {
  entry: DrawHistoryEntry;
  resolvedTitle?: MediaTitle;
  onPress?: () => void;
};

/** Card compacto para exibir um sorteio do histórico com sua ação e data. */
export const DrawHistoryCard = memo(function DrawHistoryCard({
  entry,
  resolvedTitle,
  onPress,
}: DrawHistoryCardProps) {
  const displayTitle = resolvedTitle?.title ?? entry.title ?? entry.tmdbId;
  const displayKind = resolvedTitle?.kind ?? entry.kind;
  const posterPath = resolvedTitle?.tmdbPosterPath ?? entry.tmdbPosterPath;
  const backdropPath = resolvedTitle?.tmdbBackdropPath;
  const cardColor = resolvedTitle?.color ?? entry.color ?? '#263b50';
  const actionMeta = ACTION_META[entry.acao];

  return (
    <Pressable
      disabled={!onPress}
      style={({ pressed }) => [styles.card, onPress && pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${displayTitle}, ${actionMeta.label}`}>
      <View style={[styles.poster, { backgroundColor: cardColor }]}>
        <TitleArtwork
          id={entry.tmdbId}
          variant="poster"
          posterPath={posterPath}
          backdropPath={backdropPath}
          fallback={<MaterialIcons name={resolvedTitle?.icon ?? 'movie'} size={18} color="rgba(255,255,255,0.9)" />}
        />
      </View>
      <View style={styles.copy}>
        <AppText peso="forte" style={styles.title} numberOfLines={1}>
          {displayTitle}
        </AppText>
        <AppText tipo="legenda" tabular style={styles.meta} numberOfLines={1}>
          {displayKind ? `${displayKind} · ` : ''}
          {formatShortDateTime(entry.sorteadoEm)}
        </AppText>
      </View>
      <View style={[styles.actionBadge, { backgroundColor: actionMeta.bg }]}>
        <MaterialIcons name={actionMeta.icon} size={13} color={actionMeta.color} />
        <AppText tipo="legenda" peso="forte" style={[styles.actionBadgeText, { color: actionMeta.color }]}>
          {actionMeta.label}
        </AppText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 10,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e8e2d5',
    backgroundColor: '#fffdf8',
  },
  poster: {
    width: 38,
    height: 50,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  copy: { flex: 1 },
  title: { color: '#182230', fontSize: 14, lineHeight: 19, marginBottom: 2 },
  meta: { color: '#5e5c57', fontSize: 12.5, lineHeight: 17 },
  actionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  actionBadgeText: { fontSize: 11.5 },
});
