import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs } from 'expo-router';

import { AppText } from '@/components/atoms/AppText';
import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user, authReady } = useAuth();

  if (!authReady) return null;
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f3b43f',
        tabBarInactiveTintColor: '#a9b1b8',
        tabBarHideOnKeyboard: true,
        headerShown: false,
        tabBarLabel: ({ color, children }) => (
          <AppText
            tipo="legenda"
            peso="forte"
            style={{
              color,
              fontSize: 11,
              lineHeight: 16,
              letterSpacing: 0.2,
              textAlign: 'center',
            }}>
            {children}
          </AppText>
        ),
        tabBarItemStyle: {
          justifyContent: 'center',
          alignItems: 'center',
        },
        tabBarStyle: {
          backgroundColor: '#182230',
          borderTopColor: '#263442',
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 8,
          paddingTop: 6,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tab2"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tab3"
        options={{
          title: 'Assinaturas',
          tabBarIcon: ({ color }) => <MaterialIcons size={25} name="subscriptions" color={color} />,
        }}
      />
    </Tabs>
  );
}
