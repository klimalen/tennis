import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import * as Notifications from 'expo-notifications'
import { pathFromNotificationData, requestGamePushPermission } from '../lib/push'

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

function replyPushResult(result: unknown): string {
  const payload = JSON.stringify(result)
  return `(function(){
    try {
      if (typeof window.__gamePushResult === 'function') {
        window.__gamePushResult(${payload});
      }
    } catch (e) {}
  })(); true;`
}

export default function Index() {
  const webRef = useRef<WebView>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  const navigateInApp = useCallback((path: string) => {
    const target = path.startsWith('/') ? path : `/${path}`
    webRef.current?.injectJavaScript(`(function(){
      try { window.location.assign(${JSON.stringify(target)}); } catch (e) {}
    })(); true;`)
  }, [])

  useEffect(() => {
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const path = pathFromNotificationData(response?.notification.request.content.data as Record<string, unknown> | undefined)
      if (path) setPendingPath(path)
    })

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const path = pathFromNotificationData(response.notification.request.content.data as Record<string, unknown> | undefined)
      if (path) navigateInApp(path)
    })
    return () => sub.remove()
  }, [navigateInApp])

  function onShouldStartLoadWithRequest(request: { url: string }) {
    const url = request.url
    if (!url || url === 'about:blank') return true
    if (isAppUrl(url)) {
      void Linking.openURL(url)
      return false
    }
    return true
  }

  async function onMessage(event: WebViewMessageEvent) {
    let raw: unknown
    try {
      raw = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (!raw || typeof raw !== 'object') return
    const message = raw as { type?: string }
    if (message.type !== 'request-push') return

    const result = await requestGamePushPermission()
    webRef.current?.injectJavaScript(replyPushResult(result))
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
            ref={webRef}
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
            thirdPartyCookiesEnabled
            domStorageEnabled
            cacheEnabled
            decelerationRate="normal"
            contentInsetAdjustmentBehavior="never"
            injectedJavaScriptBeforeContentLoaded={NATIVE_BOOT}
            injectedJavaScript={NATIVE_BOOT}
            onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
            onMessage={(event) => {
              void onMessage(event)
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => {
              setLoading(false)
              if (pendingPath) {
                navigateInApp(pendingPath)
                setPendingPath(null)
              }
            }}
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
