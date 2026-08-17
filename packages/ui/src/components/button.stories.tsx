import type { Meta, StoryObj } from '@storybook/react-vite'
import { Sun } from 'lucide-react'
import { Button, LoadingButton } from './button'

/**
 * Six variants, four sizes, `asChild` for polymorphic rendering, and a
 * `LoadingButton` wrapper for async actions. Examples below are pulled from
 * real call sites in apps/web (forgot-password form, error-boundary retry,
 * theme-toggle trigger) rather than invented ones.
 */
const meta: Meta<typeof Button> = {
  title: 'Primitives/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link', 'primary'],
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon'],
    },
  },
}
export default meta
type Story = StoryObj<typeof meta>

// apps/web/src/app/forgot-password/page.tsx — form submit button
export const Default: Story = {
  args: { children: 'Send reset link' },
}

// apps/web error-boundary retry action
export const Outline: Story = {
  args: { children: 'Try again', variant: 'outline' },
}

export const Destructive: Story = {
  args: { children: 'Delete account', variant: 'destructive' },
}

// apps/web/src/app/forgot-password/page.tsx — "Back to login", rendered as <a>
export const AsLink: Story = {
  args: { variant: 'link', className: 'text-sm', asChild: true },
  render: (args) => (
    <Button {...args}>
      <a href="/login">Back to login</a>
    </Button>
  ),
}

// brand-colored CTA (marketing surfaces)
export const Primary: Story = {
  args: { children: 'Get started', variant: 'primary' },
}

// apps/web/src/components/ui/theme-toggle.tsx — icon-only dropdown trigger
export const IconOnly: Story = {
  args: { variant: 'outline', size: 'icon', className: 'rounded-full' },
  render: (args) => (
    <Button {...args}>
      <Sun className="h-[1.2rem] w-[1.2rem]" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  ),
}

export const Loading: Story = {
  render: () => (
    <LoadingButton isLoading loadingText="Sending...">
      Send reset link
    </LoadingButton>
  ),
}
