import { StyleSheet, Text, View } from 'react-native';
import { colors, radii } from '../constants/theme';

/**
 * KitchenOS uncertainty rule: any data that isn't confirmed by the user
 * must be visually distinguishable, everywhere it appears. This badge is
 * the single place that renders it, so later phases (AI-estimated expiry,
 * receipt scans, etc.) reuse it instead of inventing new indicators.
 */
export function UncertaintyBadge() {
  return (
    <View style={styles.badge} accessibilityLabel="Needs verification">
      <Text style={styles.text}>?</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    backgroundColor: colors.uncertainBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: colors.uncertain,
    fontWeight: '700',
    fontSize: 13,
  },
});
