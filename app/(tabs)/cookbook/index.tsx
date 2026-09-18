import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CookbookView } from '../../../components/CookbookView';
import { CookHistoryView } from '../../../components/CookHistoryView';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { SuggestedRecipesView } from '../../../components/SuggestedRecipesView';
import { colors, spacing } from '../../../constants/theme';

type CookView = 'suggested' | 'cookbook' | 'history';

const VIEW_SEGMENTS: { value: CookView; label: string }[] = [
  { value: 'suggested', label: 'Suggested' },
  { value: 'cookbook', label: 'Cookbook' },
  { value: 'history', label: 'History' },
];

export default function CookScreen() {
  const [view, setView] = useState<CookView>('suggested');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Text style={styles.title}>Cook</Text>
      <View style={styles.segmentWrapper}>
        <SegmentedControl segments={VIEW_SEGMENTS} value={view} onChange={setView} />
      </View>

      {view === 'suggested' ? (
        <SuggestedRecipesView />
      ) : view === 'cookbook' ? (
        <CookbookView />
      ) : (
        <CookHistoryView />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 36,
    color: colors.text,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' }),
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  segmentWrapper: {
    padding: spacing.md,
  },
});
