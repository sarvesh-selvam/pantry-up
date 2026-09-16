import { Stack } from 'expo-router';
import { InventoryProvider } from '../../../lib/inventory/InventoryContext';

export default function PantryLayout() {
  return (
    <InventoryProvider>
      <Stack screenOptions={{ headerShown: true }}>
        <Stack.Screen name="index" options={{ title: 'Pantry' }} />
        <Stack.Screen name="add" options={{ title: 'Add Item', presentation: 'modal' }} />
        <Stack.Screen name="[id]" options={{ title: 'Edit Item' }} />
        <Stack.Screen
          name="quick-add"
          options={{ title: 'Quick Add', presentation: 'modal' }}
        />
        <Stack.Screen
          name="quick-add-review"
          options={{ title: 'Review Items' }}
        />
      </Stack>
    </InventoryProvider>
  );
}
