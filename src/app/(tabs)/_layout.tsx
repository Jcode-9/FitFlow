import { Tabs } from 'expo-router';
import { palette } from '@/constants/app-theme';
export default function TabLayout() { return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: palette.accent, tabBarStyle: { backgroundColor: '#101714', borderTopColor: '#29342E' }, tabBarLabelStyle: { fontSize: 11, fontWeight: '600' } }}><Tabs.Screen name="index" options={{ title: 'Dziennik' }} /><Tabs.Screen name="progress" options={{ title: 'Postępy' }} /><Tabs.Screen name="coach" options={{ title: 'Sugestie AI' }} /></Tabs>; }
