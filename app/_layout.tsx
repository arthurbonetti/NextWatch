import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { router, Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ModalPortalHost, ModalPortalProvider } from '@/components/atoms/ModalPortal';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { queryClient } from '@/services/queryClient';
import { patchWebScrollViewRejectionWarning } from '@/utils/patchWebScrollView';
import {
  isPasswordRecoveryUrl,
  parseRecoveryUrlParams,
  setPendingRecoveryParams,
} from '@/utils/recoveryUrl';

patchWebScrollViewRejectionWarning();
void SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

function RecoveryLinkGuard() {
  const { isPasswordRecovery, authReady } = useAuth();
  const pathname = usePathname();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    const webHref = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null;
    const candidateUrl = incomingUrl ?? webHref;

    if (isPasswordRecoveryUrl(candidateUrl) && pathname !== '/reset-password') {
      const parsed = parseRecoveryUrlParams(candidateUrl);
      setPendingRecoveryParams(parsed);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          window.history.replaceState(null, '', '/reset-password');
        } catch {
          // Ignora falha ao atualizar URL
        }
      }
      router.replace('/(auth)/reset-password');
      return;
    }

    if (authReady && isPasswordRecovery && pathname !== '/reset-password') {
      router.replace('/(auth)/reset-password');
    }
  }, [authReady, incomingUrl, isPasswordRecovery, pathname]);

  return null;
}

function RootLayoutShell() {
  const { colors, isDark, themeReady } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    ...MaterialIcons.font,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if ((fontsLoaded || fontError) && themeReady) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded, fontError, themeReady]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = 'pt-BR';
    root.style.setProperty('-webkit-font-smoothing', 'antialiased');
    root.style.setProperty('-moz-osx-font-smoothing', 'grayscale');

    const styleId = 'nextwatch-web-focus-styles';
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement('style');
      styleEl.id = styleId;
      styleEl.textContent = `
        *:focus:not(:focus-visible) {
          outline: none !important;
        }
        input:focus,
        textarea:focus {
          outline: none !important;
        }
        button:focus-visible,
        a:focus-visible,
        [role="button"]:focus-visible,
        [role="tab"]:focus-visible,
        [role="radio"]:focus-visible,
        [role="checkbox"]:focus-visible,
        [role="switch"]:focus-visible {
          outline: 2px solid var(--nw-focus-ring, #F2AE30);
          outline-offset: 2px;
        }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  if ((!fontsLoaded && !fontError) || !themeReady) {
    return null;
  }

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.bgPrimary }]}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RecoveryLinkGuard />
            <ModalPortalProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.bgPrimary },
                }}>
                <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)/reset-password" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="subscriptions" options={{ headerShown: false }} />
                <Stack.Screen name="my-list" options={{ headerShown: false }} />
                <Stack.Screen name="draw-history" options={{ headerShown: false }} />
                <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
                <Stack.Screen name="title/[id]" options={{ headerShown: false }} />
              </Stack>
              <ModalPortalHost />
            </ModalPortalProvider>
          </AuthProvider>
        </QueryClientProvider>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.bgPrimary}
        />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutShell />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
