import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';

export default function TabLayout() {
  const { user } = useAuth();

  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f3b43f',
        tabBarInactiveTintColor: '#a9b1b8',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#182230',
          borderTopColor: '#263442',
          borderTopWidth: 1,
          height: 72,
          paddingBottom: 10,
          paddingTop: 10,
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
          tabBarIcon: ({ color }) => <MaterialIcons size={26} name="bookmark" color={color} />,
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
