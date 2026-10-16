import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#f3b43f',
        tabBarInactiveTintColor: '#a9b1b8',
        headerShown: false,
        tabBarButton: HapticTab,
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
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="tab2"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="bookmark.fill" color={color} />,
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
