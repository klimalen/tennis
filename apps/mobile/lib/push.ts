import { Platform } from 'react-native'
import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export type PushBridgeResult = {
  status: 'granted' | 'denied' | 'unavailable' | 'error'
  token?: string
  platform?: 'ios' | 'android'
  message?: string
}

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.['eas']?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  )
}

export async function requestGamePushPermission(): Promise<PushBridgeResult> {
  if (!Device.isDevice) {
    return { status: 'unavailable', message: 'Push needs a physical device' }
  }

  try {
    const current = await Notifications.getPermissionsAsync()
    let status = current.status
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync()
      status = asked.status
    }
    if (status !== 'granted') {
      return { status: 'denied' }
    }

    const id = projectId()
    const tokenResponse = id
      ? await Notifications.getExpoPushTokenAsync({ projectId: id })
      : await Notifications.getExpoPushTokenAsync()

    return {
      status: 'granted',
      token: tokenResponse.data,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
    }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Push registration failed',
    }
  }
}

export function pathFromNotificationData(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null
  if (typeof data['path'] === 'string' && data['path'].startsWith('/')) return data['path']
  if (typeof data['conversation_id'] === 'string') return `/chats/${data['conversation_id']}`
  return '/feed?tab=notifications'
}
