import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'

const WEB_URL = 'https://tennis-web-lime.vercel.app'

export default function Index() {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {failed ? (
        <View style={styles.offline}>
          <Text style={styles.title}>No connection</Text>
          <Text style={styles.body}>Check the network and try again.</Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              setFailed(false)
              setAttempt((value) => value + 1)
            }}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={attempt}
          source={{ uri: WEB_URL }}
          style={styles.web}
          originWhitelist={['https://*']}
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          setSupportMultipleWindows={false}
          allowsInlineMediaPlayback
          mediaCapturePermissionGrantType="grant"
          startInLoadingState
          renderLoading={() => (
            <View style={styles.loading}>
              <ActivityIndicator color="#3A8A7A" />
            </View>
          )}
          onError={() => setFailed(true)}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) setFailed(true)
          }}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF7F2' },
  web: { flex: 1, backgroundColor: '#FAF7F2' },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF7F2',
  },
  offline: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 22, color: '#1a1a1a' },
  body: { marginTop: 8, fontSize: 15, color: 'rgba(26,26,26,0.7)', textAlign: 'center' },
  button: { marginTop: 20, backgroundColor: '#1a1a1a', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 22 },
  buttonLabel: { color: '#FAF7F2', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
})
