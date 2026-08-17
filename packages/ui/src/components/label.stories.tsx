import type { Meta, StoryObj } from '@storybook/react-vite'
import { Label } from './label'
import { Input } from './input'

/**
 * Always paired with a field via htmlFor — apps/web/forgot-password pairs it
 * with the email Input exactly like this. Second story shows the
 * peer-disabled styling baked into labelVariants.
 */
const meta: Meta<typeof Label> = {
  title: 'Primitives/Label',
  component: Label,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof meta>

export const WithInput: Story = {
  render: () => (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" placeholder="m@example.com" />
    </div>
  ),
}

export const DisabledPeer: Story = {
  render: () => (
    <div className="flex items-center gap-2">
      <input id="disabled-field" className="peer" type="checkbox" disabled />
      <Label htmlFor="disabled-field">Unavailable option</Label>
    </div>
  ),
}
