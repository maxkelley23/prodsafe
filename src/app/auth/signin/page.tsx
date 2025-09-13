"use client"

import { signIn, getProviders } from "next-auth/react"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Shield, Github, AlertTriangle, Loader2 } from "lucide-react"

interface Provider {
  id: string
  name: string
  type: string
}

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null)
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()
  const error = searchParams.get("error")
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"

  useEffect(() => {
    const loadProviders = async () => {
      const res = await getProviders()
      setProviders(res)
    }
    loadProviders()
  }, [])

  const handleSignIn = async (providerId: string) => {
    setLoading(true)
    try {
      await signIn(providerId, {
        callbackUrl,
        redirect: true
      })
    } catch (error) {
      console.error("Sign in error:", error)
      setLoading(false)
    }
  }

  const getErrorMessage = (error: string | null) => {
    switch (error) {
      case "OAuthSignin":
        return "Error in constructing an authorization URL"
      case "OAuthCallback":
        return "Error in handling the response from an OAuth provider"
      case "OAuthCreateAccount":
        return "Could not create OAuth account in the database"
      case "EmailCreateAccount":
        return "Could not create email account in the database"
      case "Callback":
        return "Error in the OAuth callback handler route"
      case "OAuthAccountNotLinked":
        return "Email on the account is already linked, but not with this OAuth account"
      case "EmailSignin":
        return "Sending the email with the verification token failed"
      case "CredentialsSignin":
        return "The credentials you provided are not valid"
      case "SessionRequired":
        return "The content of this page requires you to be signed in at all times"
      case "AccessDenied":
        return "Your account is not active. Please contact support for assistance."
      default:
        return error ? "An unexpected error occurred during sign in" : null
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo and Header */}
        <div className="flex justify-center">
          <div className="flex items-center space-x-2">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-3 rounded-xl shadow-lg">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                ProdSafe
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Security Platform
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Access your security dashboard and monitoring tools
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-2xl sm:px-10">
          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                    Authentication Error
                  </h3>
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    {getErrorMessage(error)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="mb-6 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Shield className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Secure Authentication
                </h3>
                <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                  All sign-in attempts are logged and monitored for security purposes.
                </div>
              </div>
            </div>
          </div>

          {/* Sign-in Options */}
          <div className="space-y-4">
            {providers &&
              Object.values(providers).map((provider) => (
                <div key={provider.name}>
                  <button
                    type="button"
                    onClick={() => handleSignIn(provider.id)}
                    disabled={loading}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-slate-700 dark:hover:bg-slate-600 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                      {loading ? (
                        <Loader2 className="h-5 w-5 text-slate-300 group-hover:text-slate-200 animate-spin" />
                      ) : provider.id === "github" ? (
                        <Github className="h-5 w-5 text-slate-300 group-hover:text-slate-200" />
                      ) : (
                        <Shield className="h-5 w-5 text-slate-300 group-hover:text-slate-200" />
                      )}
                    </span>
                    {loading ? "Signing in..." : `Sign in with ${provider.name}`}
                  </button>
                </div>
              ))}

            {!providers && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
              </div>
            )}
          </div>

          {/* Security Features */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Security Features
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>OAuth 2.0 Secure</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>Activity Monitoring</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>Rate Limiting</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>Audit Logging</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              By signing in, you agree to our security monitoring and logging practices.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}