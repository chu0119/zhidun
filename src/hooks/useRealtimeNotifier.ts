// 实时监控→通知引擎 React Hook

import { useEffect, useRef } from 'react'
import { useRealtimeStore } from '@/stores/realtime-store'
import { useConfigStore } from '@/stores/config-store'
import { useAlertHistoryStore } from '@/stores/alert-history-store'
import { processRealtimeMatch } from '@/core/realtime-notifier'

export function useRealtimeNotifier() {
  const matches = useRealtimeStore(s => s.matches)
  const monitorId = useRealtimeStore(s => s.monitorId)
  const processedCountRef = useRef(0)

  useEffect(() => {
    if (matches.length <= processedCountRef.current) return

    const config = useConfigStore.getState().config
    const notifConfig = config.notificationConfig
    const rtConfig = config.realtimeNotificationConfig

    if (!notifConfig?.enabled || !rtConfig?.enabled) {
      processedCountRef.current = matches.length
      return
    }

    const newMatches = matches.slice(processedCountRef.current)
    processedCountRef.current = matches.length

    for (const match of newMatches) {
      processRealtimeMatch(match, notifConfig, rtConfig).then(({ notified, results }) => {
        useAlertHistoryStore.getState().addAlert({
          ruleId: match.ruleId,
          ruleName: match.ruleName,
          category: match.category,
          severity: match.severity,
          matchedText: match.matchedText,
          notified,
          channelResults: results,
        })
      }).catch((err) => {
        console.error('[realtime-notifier] 处理匹配失败:', err)
      })
    }
  }, [matches])

  useEffect(() => {
    if (!monitorId) {
      processedCountRef.current = 0
    }
  }, [monitorId])
}
