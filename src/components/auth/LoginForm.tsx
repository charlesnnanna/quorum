'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth/auth-client'
import { ensureProfile } from '@/lib/actions/auth'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface LoginFormProps {
  mode: 'login' | 'register'
}

export default function LoginForm({ mode }: LoginFormProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginInput | 'name', string>>>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setFieldErrors({})
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string

    try {
      if (mode === 'register') {
        // Validate with extended schema
        const result = loginSchema.safeParse({ email, password })
        if (!result.success) {
          const errors: typeof fieldErrors = {}
          result.error.issues.forEach((issue) => {
            const field = issue.path[0] as keyof typeof errors
            if (!errors[field]) errors[field] = issue.message
          })
          setFieldErrors(errors)
          setIsLoading(false)
          return
        }

        if (!name || name.trim().length === 0) {
          setFieldErrors({ name: 'Name is required' })
          setIsLoading(false)
          return
        }

        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: name.trim(),
        })

        if (signUpError) {
          setError(signUpError.message ?? 'Registration failed')
          setIsLoading(false)
          return
        }
      } else {
        const result = loginSchema.safeParse({ email, password })
        if (!result.success) {
          const errors: typeof fieldErrors = {}
          result.error.issues.forEach((issue) => {
            const field = issue.path[0] as keyof typeof errors
            if (!errors[field]) errors[field] = issue.message
          })
          setFieldErrors(errors)
          setIsLoading(false)
          return
        }

        const { error: signInError } = await authClient.signIn.email({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message ?? 'Invalid email or password')
          setIsLoading(false)
          return
        }
      }

      // Create profile in Supabase if it doesn't exist
      await ensureProfile()

      router.push('/')
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {mode === 'register' && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Your name"
            autoComplete="name"
            required={mode === 'register'}
            className="h-11 text-base md:h-9 md:text-sm"
            aria-invalid={!!fieldErrors.name}
          />
          {fieldErrors.name && (
            <p className="text-sm text-destructive">{fieldErrors.name}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          className="h-11 text-base md:h-9 md:text-sm"
          aria-invalid={!!fieldErrors.email}
        />
        {fieldErrors.email && (
          <p className="text-sm text-destructive">{fieldErrors.email}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          required
          className="h-11 text-base md:h-9 md:text-sm"
          aria-invalid={!!fieldErrors.password}
        />
        {fieldErrors.password && (
          <p className="text-sm text-destructive">{fieldErrors.password}</p>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="h-11 min-h-[44px] text-base font-medium md:h-9 md:text-sm"
      >
        {isLoading
          ? mode === 'register'
            ? 'Creating account...'
            : 'Signing in...'
          : mode === 'register'
            ? 'Create account'
            : 'Sign in'}
      </Button>
    </form>
  )
}
