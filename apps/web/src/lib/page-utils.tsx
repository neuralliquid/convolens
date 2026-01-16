"use client"

import { ReactNode, Suspense, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { PageLoading } from '@/components/ui/loading'
import PageWrapper from '@/app/page-wrapper'

type DynamicComponentProps = {
  component: () => Promise<{ default: React.ComponentType<any> }>
  loading?: ReactNode
}

export function createPage(componentImport: () => Promise<any>) {
  const DynamicComponent = dynamic(
    () => componentImport().then(mod => ({
      default: mod.default || mod
    })),
    { 
      loading: () => <PageLoading />,
      ssr: false
    }
  )

  return function WrappedPage() {
    const [isMounted, setIsMounted] = useState(false)

    useEffect(() => {
      setIsMounted(true)
    }, [])

    if (!isMounted) {
      return (
        <PageWrapper>
          <div className="h-full w-full flex items-center justify-center">
            <PageLoading />
          </div>
        </PageWrapper>
      )
    }

    return (
      <PageWrapper>
        <Suspense fallback={
          <div className="h-full w-full flex items-center justify-center">
            <PageLoading />
          </div>
        }>
          <DynamicComponent />
        </Suspense>
      </PageWrapper>
    )
  }
}
