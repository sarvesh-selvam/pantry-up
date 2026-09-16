import { Stack } from 'expo-router';

export default function CookbookLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Cookbook' }} />
      <Stack.Screen name="add" options={{ title: 'Add Recipe', presentation: 'modal' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan Cookbook Page', presentation: 'modal' }} />
      <Stack.Screen name="scan-review" options={{ title: 'Review Scanned Recipe' }} />
    </Stack>
  );
}
