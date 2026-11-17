import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/atoms/AppText';
import { ServiceLogo, ServiceLogoList } from '@/components/atoms/ServiceLogo';
import { getMetacriticScore, getTitleServices, MediaTitle } from '@/constants/catalog';
import { fetchTitleDuration, getCachedTitleDuration } from '@/services/tmdb';

const SYNOPSIS_PREVIEW_LIMIT = 280;

type TitleDetailsBodyProps = {
  title: MediaTitle;
  eyebrow?: string;
  pillBackgroundColor?: string;
  onScrollEnabledChange?: (scrollEnabled: boolean) => void;
};

export function TitleDetailsBody({
  title,
  eyebrow,
  pillBackgroundColor = '#f1eee7',
  onScrollEnabledChange,
}: TitleDetailsBodyProps) {
  const [prevTitle, setPrevTitle] = useState(title);
  const [duration, setDuration] = useState(() => getCachedTitleDuration(title));
  const [expanded, setExpanded] = useState(false);
  const [showAllProviders, setShowAllProviders] = useState(false);
  const [renderAllProviders, setRenderAllProviders] = useState(false);
  const [providersAnim] = useState(() => new Animated.Value(0));

  if (prevTitle !== title) {
    setPrevTitle(title);
    setExpanded(false);
    setShowAllProviders(false);
    setRenderAllProviders(false);
    setDuration(getCachedTitleDuration(title));
  }

  const isLongSynopsis = title.synopsis.length > SYNOPSIS_PREVIEW_LIMIT;
  const metacritic = getMetacriticScore(title);
  const services = getTitleServices(title);

  useEffect(() => {
    providersAnim.setValue(0);
    let active = true;
    void fetchTitleDuration(title).then((resolved) => {
      if (active) setDuration(resolved);
    });
    return () => {
      active = false;
    };
  }, [title, providersAnim]);

  const toggleAllProviders = () => {
    const next = !showAllProviders;
    setShowAllProviders(next);
    if (next) {
      setRenderAllProviders(true);
      Animated.timing(providersAnim, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(providersAnim, {
        toValue: 0,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRenderAllProviders(false);
      });
    }
  };

  useEffect(() => {
    onScrollEnabledChange?.(isLongSynopsis && expanded);
  }, [expanded, isLongSynopsis, onScrollEnabledChange]);

  return (
    <>
      {eyebrow && (
        <AppText tipo="legenda" peso="forte" style={styles.eyebrow}>
          {eyebrow}
        </AppText>
      )}
      <AppText tipo="titulo" peso="forte" style={styles.title}>
        {title.title}
      </AppText>
      <AppText tipo="legenda" tabular style={styles.meta}>
        {title.year || 'Ano não informado'}  ·  {title.kind}  ·  {duration}
      </AppText>

      <View style={styles.ratingRow}>
        <View style={styles.ratingBadge}>
          <MaterialIcons name="star" size={16} color="#f3b43f" />
          <AppText peso="forte" tabular style={styles.rating}>
            {title.imdbRating}
          </AppText>
          <AppText peso="forte" style={styles.ratingTag}>
            {title.ratingSource ?? 'IMDb'}
          </AppText>
        </View>
        {metacritic !== null && (
          <View
            style={[
              styles.metacriticBadge,
              metacritic >= 61 ? styles.mcGreen : metacritic >= 40 ? styles.mcYellow : styles.mcRed,
            ]}>
            <AppText peso="forte" tabular style={styles.metacriticScore}>
              {metacritic}
            </AppText>
            <AppText peso="forte" style={styles.metacriticLabel}>
              MC
            </AppText>
          </View>
        )}
        <View style={styles.providerBadge}>
          <ServiceLogoList
            services={services}
            size={34}
            maxVisible={3}
            overflowSize={30}
            overflowExpanded={showAllProviders}
            onPressOverflow={toggleAllProviders}
          />
        </View>
      </View>

      {renderAllProviders && services.length > 3 && (
        <Animated.View
          style={[
            styles.allProvidersRow,
            {
              opacity: providersAnim,
              transform: [
                {
                  translateY: providersAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-6, 0],
                  }),
                },
                {
                  scale: providersAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.97, 1],
                  }),
                },
              ],
            },
          ]}>
          {services.map((serviceName) => (
            <View key={serviceName} style={[styles.providerPill, { backgroundColor: pillBackgroundColor }]}>
              <ServiceLogo name={serviceName} size={18} />
              <AppText tipo="legenda" peso="forte" style={styles.providerPillText}>
                {serviceName}
              </AppText>
            </View>
          ))}
        </Animated.View>
      )}

      <AppText peso="medio" style={styles.genres}>
        {title.genres.join('  ·  ')}
      </AppText>

      <AppText tipo="subtitulo" peso="forte" style={styles.sectionTitle}>
        Sinopse
      </AppText>
      <AppText
        tipo="texto"
        style={[styles.synopsis, isLongSynopsis && styles.synopsisWithToggle]}
        numberOfLines={isLongSynopsis && !expanded ? 4 : undefined}>
        {title.synopsis}
      </AppText>
      {isLongSynopsis && (
        <Pressable
          style={({ pressed }) => [styles.expandButton, pressed && styles.pressed]}
          hitSlop={8}
          onPress={() => setExpanded((prev) => !prev)}
          accessibilityRole="button">
          <AppText tipo="legenda" peso="forte" style={styles.expandButtonText}>
            {expanded ? 'Mostrar menos' : 'Mostrar mais'}
          </AppText>
          <MaterialIcons name={expanded ? 'expand-less' : 'expand-more'} size={18} color="#d77c29" />
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  eyebrow: { color: '#d77c29', letterSpacing: 1.3, marginBottom: 4 },
  title: { color: '#182230', fontSize: 25, lineHeight: 30, letterSpacing: -0.45, marginBottom: 4 },
  meta: { color: '#7b7b78', fontSize: 13, lineHeight: 18 },
  ratingRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14, marginBottom: 12 },
  ratingBadge: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 9, borderRadius: 11, backgroundColor: '#182230' },
  rating: { color: '#fffdf8', fontSize: 15, lineHeight: 18 },
  ratingTag: { color: '#f3b43f', fontSize: 10, lineHeight: 13, letterSpacing: 0.4 },
  metacriticBadge: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderRadius: 11 },
  mcGreen: { backgroundColor: '#2e8b57' },
  mcYellow: { backgroundColor: '#d49b27' },
  mcRed: { backgroundColor: '#c0392b' },
  metacriticScore: { color: '#fffdf8', fontSize: 15, lineHeight: 18 },
  metacriticLabel: { color: 'rgba(255,253,248,0.9)', fontSize: 10, lineHeight: 13, letterSpacing: 0.4 },
  providerBadge: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  allProvidersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  providerPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  providerPillText: { color: '#182230', fontSize: 11 },
  genres: { color: '#8d7a61', fontSize: 13, lineHeight: 19, letterSpacing: 0.2, marginBottom: 14 },
  sectionTitle: { color: '#182230', fontSize: 17, lineHeight: 23, marginBottom: 6 },
  synopsis: { color: '#687078', fontSize: 15.5, lineHeight: 24, maxWidth: 560, marginBottom: 18 },
  synopsisWithToggle: { marginBottom: 4 },
  expandButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 2, paddingVertical: 3, marginBottom: 14 },
  expandButtonText: { color: '#d77c29', fontSize: 13 },
});
