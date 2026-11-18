import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ModalPortalHost, ModalPortalProvider } from '@/components/atoms/ModalPortal';
import { AuthProvider } from '@/contexts/AuthContext';
import { CatalogProvider } from '@/contexts/CatalogContext';
import { DrawHistoryProvider } from '@/contexts/DrawHistoryContext';
import { MyListProvider } from '@/contexts/MyListContext';
import { SubscriptionsProvider } from '@/contexts/SubscriptionsContext';

void SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = 'pt-BR';
    root.style.setProperty('-webkit-font-smoothing', 'antialiased');
    root.style.setProperty('-moz-osx-font-smoothing', 'grayscale');
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <SubscriptionsProvider>
            <CatalogProvider>
              <MyListProvider>
                <DrawHistoryProvider>
                  <ModalPortalProvider>
                    <Stack>
                      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
                      <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
                      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                      <Stack.Screen name="subscriptions" options={{ headerShown: false }} />
                      <Stack.Screen name="my-list" options={{ headerShown: false }} />
                      <Stack.Screen name="draw-history" options={{ headerShown: false }} />
                      <Stack.Screen name="title/[id]" options={{ headerShown: false }} />
                    </Stack>
                    <ModalPortalHost />
                  </ModalPortalProvider>
                </DrawHistoryProvider>
              </MyListProvider>
            </CatalogProvider>
          </SubscriptionsProvider>
        </AuthProvider>
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
