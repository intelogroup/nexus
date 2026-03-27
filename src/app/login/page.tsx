'use client'

import { useState, use, useTransition } from 'react'
import { login, signup } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>
}) {
  const { error, message } = use(searchParams)
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md transition-all duration-300">
        <CardHeader className="space-y-1">
          <h1 className="text-2xl font-bold">
            {mode === 'login' ? 'Welcome back' : 'Create an account'}
          </h1>
          <CardDescription>
            {mode === 'login' 
              ? 'Enter your email and password to access your account' 
              : 'Enter your details to create a new account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4">
            {error && (
              <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            {message && (
              <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                {message}
              </div>
            )}
            
            {mode === 'signup' && (
              <div className="grid gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="johndoe"
                  required
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="m@example.com"
                required
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>

            <div className="flex flex-col gap-2 mt-2">
              {mode === 'login' ? (
                <>
                  <Button type="submit" formAction={(formData) => startTransition(() => login(formData))} disabled={isPending}>
                    {isPending ? 'Logging in…' : 'Log in'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setMode('signup')}
                    className="text-sm"
                  >
                    Don't have an account? Sign up
                  </Button>
                </>
              ) : (
                <>
                  <Button type="submit" formAction={(formData) => startTransition(() => signup(formData))} disabled={isPending}>
                    {isPending ? 'Signing up…' : 'Sign up'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    onClick={() => setMode('login')}
                    className="text-sm"
                  >
                    Already have an account? Log in
                  </Button>
                </>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <div className="text-center text-sm text-muted-foreground">
            By clicking continue, you agree to our terms and conditions.
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
