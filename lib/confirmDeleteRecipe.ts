import { Alert } from 'react-native';

/** Shared confirm for Cookbook's trash button and the recipe detail
 * screen, so both warn the same way. Resolves true only on Delete. */
export function confirmDeleteRecipe(title: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Delete recipe?',
      `"${title}" will be removed from your Cookbook. Your cooking history for it is kept.`,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
