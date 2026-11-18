import { StyleSheet, View } from 'react-native';

import { SkeletonBox } from '@/components/atoms/SkeletonBox';
import { THEME } from '@/constants/theme';

export function TitleDetailsSkeleton() {
  return (
    <View style={styles.container}>
      <View style={styles.chipsRow}>
        <SkeletonBox width="48%" height={54} borderRadius={THEME.radius.md} />
        <SkeletonBox width="48%" height={54} borderRadius={THEME.radius.md} />
      </View>

      <View style={styles.block}>
        <SkeletonBox width={120} height={16} />
        <View style={styles.castRow}>
          {[0, 1, 2, 3].map((idx) => (
            <View key={idx} style={styles.castItem}>
              <SkeletonBox width={70} height={70} borderRadius={35} />
              <SkeletonBox width={64} height={11} />
            </View>
          ))}
        </View>
      </View>

      <View style={styles.block}>
        <SkeletonBox width={150} height={16} />
        <SkeletonBox width="100%" height={118} borderRadius={THEME.radius.md} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: THEME.spacing.lg,
  },
  chipsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: THEME.spacing.sm,
  },
  block: {
    gap: THEME.spacing.sm,
  },
  castRow: {
    flexDirection: 'row',
    gap: THEME.spacing.md,
  },
  castItem: {
    alignItems: 'center',
    gap: 6,
  },
});
