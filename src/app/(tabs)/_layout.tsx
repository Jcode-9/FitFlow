import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { palette } from '@/constants/app-theme';
export default function TabLayout() { return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.accent, tabBarStyle: { backgroundColor: '#101714', borderTopColor: '#29342E' }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' }, tabBarHideOnKeyboard: true }}>
  <Tabs.Screen name="index" options={{ title: 'Dziennik', tabBarIcon: ({ color, size }) => <SymbolView name={{ ios: 'book.closed.fill', android: 'menu_book', web: 'menu_book' }} tintColor={color ?? palette.muted} size={size} /> }} />
  <Tabs.Screen name="progress" options={{ title: 'Postępy', tabBarIcon: ({ color, size }) => <SymbolView name={{ ios: 'chart.xyaxis.line', android: 'monitoring', web: 'monitoring' }} tintColor={color ?? palette.muted} size={size} /> }} />
  <Tabs.Screen name="coach" options={{ title: 'Sugestie AI', tabBarIcon: ({ color, size }) => <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} tintColor={color ?? palette.muted} size={size} /> }} />
</Tabs>; }
