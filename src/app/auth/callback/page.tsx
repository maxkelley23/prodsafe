"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import { Shield, Loader2, CheckCircle, AlertCircle } from "lucide-react"

export default function AuthCallbackPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loadingMessage, setLoadingMessage] = useState("Authenticating...")
  const [countdown, setCountdown] = useState(3)

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const error = searchParams.get("error")

  useEffect(() => {
    if (error) {
      setLoadingMessage("Authentication failed")
      setTimeout(() => {
        router.push(`/auth/error?error=${error}`)
      }, 2000)
      return
    }

    if (status === "loading") {
      setLoadingMessage("Verifying your credentials...")
      return
    }

    if (status === "authenticated" && session) {
      setLoadingMessage("Authentication successful!")

      // Start countdown
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            router.push(callbackUrl)
            return 0
          }
          return prev - 1
        })
      }, 1000)

      return () => clearInterval(timer)
    }

    if (status === "unauthenticated") {
      setLoadingMessage("Redirecting to sign in...")
      setTimeout(() => {
        router.push("/auth/signin")
      }, 2000)
    }
  }, [status, session, router, callbackUrl, error])

  const getStatusIcon = () => {
    if (error) {
      return <AlertCircle className="h-8 w-8 text-red-500" />
    }

    if (status === "authenticated") {
      return <CheckCircle className="h-8 w-8 text-green-500" />
    }

    return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
  }

  const getStatusColor = () => {
    if (error) return "red"
    if (status === "authenticated") return "green"
    return "blue"
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
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-2xl sm:px-10">
          {/* Status Display */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              {status === "authenticated" ? "Welcome!" : "Processing..."}
            </h2>

            <p className="text-slate-600 dark:text-slate-400 mb-6">
              {loadingMessage}
            </p>

            {/* Progress Indicator */}
            {!error && status !== "authenticated" && (
              <div className="mb-6">
                <div className="flex justify-center space-x-2 mb-3">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-2 w-8 rounded-full transition-colors duration-300 ${
                        status === "loading" || step === 1
                          ? "bg-blue-500"
                          : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {status === "loading" ? "Step 1 of 3: Verifying credentials" : "Initializing..."}
                </p>
              </div>
            )}

            {/* Success State with Countdown */}
            {status === "authenticated" && session && (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 p-4">
                  <div className="flex items-center justify-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      Successfully authenticated as {session.user.name || session.user.email}
                    </span>
                  </div>
                </div>

                <div className="text-sm text-slate-600 dark:text-slate-400">
                  Redirecting to your dashboard in{" "}
                  <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                    {countdown}
                  </span>{" "}
                  seconds...
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 p-4">
                <div className="flex items-center justify-center space-x-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-800 dark:text-red-200 font-medium">
                    Authentication failed
                  </span>
                </div>
                <p className="text-red-700 dark:text-red-300 text-sm mt-2">
                  Redirecting to error page...
                </p>
              </div>
            )}
          </div>

          {/* Security Indicators */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Security Status
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${getStatusColor() === "green" ? "bg-green-500" : "bg-blue-500"}`}></div>
                  <span>Secure Connection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${getStatusColor() === "green" ? "bg-green-500" : "bg-blue-500"}`}></div>
                  <span>OAuth 2.0 Protected</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${getStatusColor() === "green" ? "bg-green-500" : "bg-blue-500"}`}></div>
                  <span>Activity Logged</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className={`h-2 w-2 rounded-full ${getStatusColor() === "green" ? "bg-green-500" : "bg-blue-500"}`}></div>
                  <span>Session Secured</span>
                </div>
              </div>
            </div>
          </div>

          {/* Manual Actions */}
          {status === "authenticated" && (
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push(callbackUrl)}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 underline"
              >
                Continue to dashboard now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}