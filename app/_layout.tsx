import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth/AuthContext';
import { InventoryProvider } from '../lib/inventory/InventoryContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Wraps the whole tree (not just (tabs)) because Sous Chef and the
            recipe detail screen live outside the tab group but still need
            live inventory/canonical-food data. InventoryProvider itself is
            a no-op until there's a session. */}
        <InventoryProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="sous-chef" options={{ presentation: 'modal', headerShown: true, title: 'Sous Chef' }} />
            <Stack.Screen name="recipe/[id]" options={{ headerShown: true, title: 'Recipe' }} />
            <Stack.Screen name="recipe/[id]/cook" options={{ headerShown: false }} />
            <Stack.Screen name="recipe/[id]/finish" options={{ headerShown: true, title: 'Finish Cooking' }} />
            <Stack.Screen name="check-in" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: true, title: 'Settings' }} />
          </Stack>
        </InventoryProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
