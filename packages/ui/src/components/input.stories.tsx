import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { useState } from 'react'
import { Input, SearchInput } from './input'

/**
 * `Input` is the base field (apps/web/forgot-password's email field);
 * `SearchInput` layers loading/clear/error states on top — used in
 * dashboard import and filter surfaces.
 */
const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { type: 'email', placeholder: 'm@example.com' },
}

export const Disabled: Story = {
  args: { placeholder: 'Disabled', disabled: true },
}

export const Search: StoryObj<typeof SearchInput> = {
  render: () => {
    const [value, setValue] = useState('')
    return (
      <SearchInput
        placeholder="Search conversations..."
        showClearButton
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClear={() => setValue('')}
      />
    )
  },
}

export const SearchWithError: StoryObj<typeof SearchInput> = {
  render: () => <SearchInput placeholder="Search..." error="No results found" />,
}
