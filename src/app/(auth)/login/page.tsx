import Link from 'next/link'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import LoginForm from '@/components/auth/LoginForm'
import SocialAuthButton from '@/components/auth/SocialAuthButton'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  // Don't redirect back if we came here due to a profile error (avoids loop)
  const session = await auth.api.getSession({ headers: headers() })
  if (session && !searchParams.error) redirect('/')

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to Quorum
          </h1>
          <p className="text-sm text-muted-foreground">
            Your team, plus the intelligence it needs
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <LoginForm mode="login" />

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with
              </span>
            </div>
          </div>

          <SocialAuthButton />
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}
