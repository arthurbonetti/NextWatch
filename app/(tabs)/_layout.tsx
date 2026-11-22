import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs, usePathname } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { BottomFadeScrim } from '@/components/atoms/BottomFadeScrim';
import { Theme } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme, useThemedStyles } from '@/contexts/ThemeContext';
import { isPasswordRecoveryUrl } from '@/utils/recoveryUrl';

type FloatingTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function FloatingTabBar({ state, descriptors, navigation, insets }: FloatingTabBarProps) {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(8, insets.bottom + 2), pointerEvents: 'box-none' },
      ]}>
      <BottomFadeScrim
        color={colors.bgPrimary}
        height={Math.max(108, 92 + insets.bottom)}
        style={styles.bottomScrim}
      />
      <View style={styles.dock} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
          const color = focused ? colors.tabBarActiveTint : colors.tabBarInactiveTint;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={({ pressed }) => [
                styles.item,
                focused && styles.itemActive,
                pressed && styles.itemPressed,
              ]}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <AppText
                tipo="legenda"
                peso={focused ? 'forte' : 'semiforte'}
                numberOfLines={1}
                style={[styles.label, { color }]}>
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { user, authReady, isPasswordRecovery } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const webRecoveryPending =
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    isPasswordRecoveryUrl(window.location.href);

  if (!authReady || webRecoveryPending) return null;
  if (isPasswordRecovery) return <Redirect href="/(auth)/reset-password" />;
  if (!user) {
    if (pathname === '/reset-password') return null;
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} insets={insets} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bgPrimary },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, size }) => <MaterialIcons size={size} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tab2"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size }) => <MaterialIcons size={size} name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tab3"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <MaterialIcons size={size} name="person" color={color} />,
        }}
      />
    </Tabs>
  );
}

const createStyles = (theme: Theme) => ({
  wrapper: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
  },
  bottomScrim: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    bottom: 0,
  },
  dock: {
    width: '100%' as const,
    maxWidth: 400,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    padding: 6,
    borderRadius: 28,
    backgroundColor: theme.colors.tabBarBg,
    borderWidth: 1,
    borderColor: theme.colors.tabBarBorder,
    shadowColor: theme.isDark ? theme.colors.bgPrimary : theme.colors.heroBg,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: theme.isDark ? 0.36 : 0.2,
    shadowRadius: 18,
    boxShadow: `0px 10px 24px ${theme.colors.tabBarShadow}`,
    elevation: 10,
  },
  item: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.colors.transparent,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  itemActive: {
    backgroundColor: theme.colors.tabBarActiveBg,
    borderColor: theme.colors.tabBarActiveBorder,
  },
  itemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
    textAlign: 'center' as const,
  },
});
