import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { CheckCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from './card'
import { Button } from './button'
import { Input } from './input'
import { Label } from './label'

/**
 * Structure lifted from apps/web/src/app/forgot-password/page.tsx — the most
 * representative real composition of Card with the other primitives
 * (Button, Input, Label) in one form, plus its own success state.
 * Router/auth hooks from the real page are swapped for local state so the
 * story has no app-level dependencies.
 */
const meta: Meta<typeof Card> = {
  title: 'Primitives/Card',
  component: Card,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof meta>

export const FormCard: Story = {
  render: () => {
    const [email, setEmail] = useState('')
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-2xl font-bold">Forgot your password?</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button className="w-full">Send reset link</Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Button variant="link" className="text-sm">
            Back to login
          </Button>
        </CardFooter>
      </Card>
    )
  },
}

export const SuccessState: Story = {
  render: () => (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="space-y-2 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
        <CardDescription>We&apos;ve sent a password reset link to you@example.com</CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          If you don&apos;t see the email, check your spam folder or try again.
        </p>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Button variant="link" className="text-sm">
          Back to login
        </Button>
      </CardFooter>
    </Card>
  ),
}
