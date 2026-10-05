import { useState } from 'react'
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'

const WEB_URL = 'https://www.game-tennis.space'

const NATIVE_BOOT = `(function(){
  document.documentElement.classList.add('game-native');
  var titles = {
    'Add to your home screen': 1,
    'Open in Safari': 1,
    'Install the app': 1,
    'На экран «Домой»': 1,
    'Откройте в Safari': 1,
    'Установить приложение': 1
  };
  function hidePwa() {
    var nodes = document.querySelectorAll('p,h1,h2,h3,span');
    for (var i = 0; i < nodes.length; i++) {
      var text = (nodes[i].textContent || '').trim();
      if (!titles[text]) continue;
      var el = nodes[i];
      for (var j = 0; j < 8 && el; j++) {
        if (el.className && String(el.className).indexOf('rounded-[28px]') !== -1) {
          el.style.setProperty('display', 'none', 'important');
          break;
        }
        el = el.parentElement;
      }
    }
  }
  hidePwa();
  new MutationObserver(hidePwa).observe(document.documentElement, { childList: true, subtree: true });
})();
true;`

function isAppUrl(url: string): boolean {
  return /^(tel:|mailto:|sms:|geo:|itms-apps:)/i.test(url)
}

export default function Index() {
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)

  function onShouldStartLoadWithRequest(request: { url: string }) {
    const url = request.url
    if (!url || url === 'about:blank') return true
    if (isAppUrl(url)) {
      void Linking.openURL(url)
      return false
    }
    return true
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {failed ? (
        <View style={styles.offline}>
          <Text style={styles.title}>No connection</Text>
          <Text style={styles.body}>Check the network and try again.</Text>
          <Pressable
            style={styles.button}
            onPress={() => {
              setFailed(false)
              setLoading(true)
              setAttempt((value) => value + 1)
            }}
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.webWrap}>
          <WebView
            key={attempt}
            source={{ uri: WEB_URL }}
            style={styles.web}
            applicationNameForUserAgent="GAMENative/ios"
            originWhitelist={['https://*', 'http://*', 'about:']}
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            setSupportMultipleWindows={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            geolocationEnabled
            sharedCookiesEnabled
            decelerationRate="normal"
            contentInsetAdjustmentBehavior="never"
            injectedJavaScriptBeforeContentLoaded={NATIVE_BOOT}
            injectedJavaScript={NATIVE_BOOT}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => {
              setLoading(false)
              setFailed(true)
            }}
            onHttpError={(event) => {
              if (event.nativeEvent.statusCode >= 500) {
                setLoading(false)
                setFailed(true)
              }
            }}
            onOpenWindow={(event) => {
              const url = event.nativeEvent.targetUrl
              if (url) void Linking.openURL(url)
            }}
          />
          {loading ? (
            <View style={styles.loading} pointerEvents="none">
              <ActivityIndicator color="#3A8A7A" />
            </View>
          ) : null}
        </View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FAF7F2' },
  webWrap: { flex: 1 },
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
  button: {
    marginTop: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  buttonLabel: { color: '#FAF7F2', fontSize: 12, letterSpacing: 1.4, textTransform: 'uppercase' },
})
