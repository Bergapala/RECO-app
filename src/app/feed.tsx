import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const Palette = {
  background: '#1A1A1A',
  accent: '#C0392B',
  text: '#F5F2EE',
  textMuted: 'rgba(245, 242, 238, 0.5)',
};

/**
 * Écran principal une fois connecté (recommandations des amis). Écran à
 * concevoir.
 */
export default function FeedScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safeArea}>
        <Text style={styles.title}>Feed</Text>
        <Text style={styles.subtitle}>Écran à venir.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: Palette.accent,
    fontFamily: 'Syne_700Bold',
    fontSize: 28,
  },
  subtitle: {
    color: Palette.textMuted,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
  },
});
