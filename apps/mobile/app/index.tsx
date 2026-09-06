import { Text, View, StyleSheet } from 'react-native'

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tennis</Text>
      <Text style={styles.subtitle}>The social operating system for racket sports.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#16a34a' },
  subtitle: { fontSize: 16, color: '#6b7280' },
})
