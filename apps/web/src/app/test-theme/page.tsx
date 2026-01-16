"use client"

import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { ThemeToggle } from "@/components/theme-toggle"

export default function TestThemePage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="p-10">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white p-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Theme Test Page</h1>
        
        <div className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6">
          <p className="mb-4">Current theme: <strong>{theme}</strong></p>
          <ThemeToggle />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-2">Light/Dark Test</h2>
            <p className="text-gray-600 dark:text-gray-300">
              This text should change color based on the theme.
            </p>
          </div>
          
          <div className="p-6 bg-green-50 dark:bg-green-900 rounded-lg">
            <h2 className="text-xl font-semibold mb-2 text-green-800 dark:text-green-100">
              Brand Colors Test
            </h2>
            <p className="text-green-700 dark:text-green-200">
              This should use brand colors in both themes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}