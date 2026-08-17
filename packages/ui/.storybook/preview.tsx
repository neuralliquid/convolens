import type { Preview } from '@storybook/react-vite'
import * as React from 'react'

// Same stylesheet apps/web's layout.tsx imports (the real cssEntry — see
// task 13f85318). Storybook's preview and design-sync's cssEntry must stay
// pointed at ONE file, not drift into two: that drift is exactly how
// dropdown-menu's hardcoded-gray bug happened before the apps/web migration
// (8ec9b31f).
import '../../../apps/web/src/app/globals.css'

const withTheme = (Story: any, context: any) => {
  const theme = context.globals.theme ?? 'light'

  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <div
      className={theme === 'dark' ? 'dark' : ''}
      style={{
        background: 'hsl(var(--background))',
        color: 'hsl(var(--foreground))',
        minHeight: '100vh',
        padding: '1.5rem',
      }}
    >
      <Story />
    </div>
  )
}

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    },

    // The wrapper below paints the real hsl(var(--background)), so
    // Storybook's own backgrounds addon would just fight it.
    backgrounds: { disable: true },
  },

  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Light/dark theme (mirrors next-themes\' class-based toggle)',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        showName: true,
      },
    },
  },

  decorators: [withTheme],
};

export default preview;