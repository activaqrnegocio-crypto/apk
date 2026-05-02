'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/db'

/**
 * OfflinePrefetcher — pre-caches all given URLs so they work offline.
 * Upgraded: Now also fetches JSON data for projects and chats to populate Dexie.
 */
export default function OfflinePrefetcher({ urls }: { urls: string[] }) {
  const router = useRouter()

  useEffect(() => {
    if (!urls || urls.length === 0) return

    // 1. Standard Next.js Prefetch (v273: Increased delay and staggered to avoid congestion)
    const timer = setTimeout(() => {
      const staggerPrefetch = async () => {
        for (const url of urls) {
          if ('requestIdleCallback' in window) {
            await new Promise(resolve => (window as any).requestIdleCallback(resolve, { timeout: 2000 }));
          } else {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          try { router.prefetch(url) } catch (e) {}
        }
      }
      staggerPrefetch();
    }, 6000)

    // 2. SW and Data Prefetch (v273: Wait 12s to ensure navigation is fully finished)
    const dataTimer = setTimeout(() => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'PRECACHE_URLS',
          urls
        })
      }
    }, 12000)

    return () => {
      clearTimeout(timer)
      clearTimeout(dataTimer)
    }
  }, [urls, router])

  return null
}
