"use client"

import dynamic from 'next/dynamic'
import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { Bell, Settings } from 'lucide-react'
import { LoadingSkeleton } from '@/components/ui/loading-skeleton'

// Use dynamic import with SSR disabled
const Notifications = dynamic(
  () => import('@/components/features/notifications/notifications'),
  { 
    ssr: false,
    loading: () => <LoadingSkeleton />
  }
)

import PageWrapper from '../page-wrapper';

export default function NotificationsPage() {
  return (
    <PageWrapper>
      <PageHeader
        title="Notifications"
        description="Stay updated with your latest alerts"
        actions={
          <>
            <Button variant="outline" size="sm">
              <Bell className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </>
        }
      />
      <Suspense fallback={<LoadingSkeleton />}>
        <Notifications />
      </Suspense>
    </PageWrapper>
  )
}
