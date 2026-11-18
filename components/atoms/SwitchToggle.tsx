import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type SwitchToggleProps = {
  value: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function SwitchToggle({ value, onToggle, accessibilityLabel, style }: SwitchToggleProps) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [style, pressed && styles.pressed]}>
      <View style={[styles.track, value && styles.trackActive]}>
        <View style={[styles.thumb, value && styles.thumbActive]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.86, transform: [{ scale: 0.985 }] },
  track: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#d8d3c9',
    padding: 3,
    justifyContent: 'center',
  },
  trackActive: { backgroundColor: '#182230' },
  thumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fffdf8',
  },
  thumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: '#f3b43f',
  },
});
