import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { useTheme } from 'next-themes'
import { ThemeProvider } from './theme-provider'
import { Button } from './button'
import { Card, CardContent, CardHeader, CardTitle } from './card'

/**
 * ThemeProvider wraps next-themes and stays exported from @convolens/ui's
 * barrel for design-sync's component discovery — but it is NOT consumed
 * from apps/web (8ec9b31f excluded it: re-exporting it through the package
 * broke Turbopack's SSR page-data collection). This story exercises the
 * package export directly, decoupled from that app-level constraint.
 *
 * Note: the toolbar's global Theme control (see .storybook/preview.tsx)
 * and this story's own next-themes buttons both toggle the same `.dark`
 * class on the preview iframe's <html> — expected, not a bug, on this one
 * story specifically.
 */
function ThemeDemo() {
  const { theme, setTheme } = useTheme()
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Current theme: {theme}</CardTitle>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setTheme('light')}>
          Light
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTheme('dark')}>
          Dark
        </Button>
        <Button variant="outline" size="sm" onClick={() => setTheme('system')}>
          System
        </Button>
      </CardContent>
    </Card>
  )
}

const meta: Meta<typeof ThemeProvider> = {
  title: 'Primitives/ThemeProvider',
  component: ThemeProvider,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <ThemeDemo />
    </ThemeProvider>
  ),
}
