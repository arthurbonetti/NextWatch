import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs } from 'expo-router';
import { ComponentProps, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';

type FloatingTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

function FloatingTabBar({ state, descriptors, navigation, insets }: FloatingTabBarProps) {
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
      style={[styles.wrapper, { bottom: Math.max(8, insets.bottom + 2), pointerEvents: 'box-none' }]}>
      <View style={styles.dock} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : (options.title ?? route.name);
          const color = focused ? '#f3b43f' : '#a9b1b8';

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
  const { user, authReady } = useAuth();
  const insets = useSafeAreaInsets();

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} insets={insets} />}
      screenOptions={{ headerShown: false }}>
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

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  dock: {
    width: '100%',
    maxWidth: 400,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 28,
    backgroundColor: '#182230',
    borderWidth: 1,
    borderColor: '#263442',
    boxShadow: '0px 10px 24px rgba(24, 34, 48, 0.24)',
    elevation: 10,
  },
  item: {
    flex: 1,
    minHeight: 52,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  itemActive: {
    backgroundColor: 'rgba(243, 180, 63, 0.15)',
  },
  itemPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
  label: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
