import { Image } from 'expo-image';
import { View } from 'react-native';

import { Theme } from '@/constants/theme';
import { useThemedStyles } from '@/contexts/ThemeContext';

const LOGO_SOURCE = require('@/assets/images/nextwatch-logo.png');

type NextWatchLogoProps = {
  size?: number;
};

export function NextWatchLogo({ size = 38 }: NextWatchLogoProps) {
  const styles = useThemedStyles(createStyles);
  const radius = Math.round(size * 0.28);

  return (
    <View
      style={[
        styles.frame,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
      ]}
      accessible={false}>
      <Image source={LOGO_SOURCE} style={styles.image} contentFit="cover" accessible={false} />
    </View>
  );
}

const createStyles = (theme: Theme) => ({
  frame: {
    overflow: 'hidden' as const,
    backgroundColor: theme.colors.heroBg,
    borderWidth: 1,
    borderColor: theme.colors.heroBorder,
  },
  image: {
    width: '100%' as const,
    height: '100%' as const,
  },
});
