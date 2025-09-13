"use client"

import { signOut, useSession } from "next-auth/react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Shield, LogOut, ArrowLeft, User, Clock, Loader2 } from "lucide-react"

export default function SignOutPage() {
  const { data: session } = useSession()
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut({
        callbackUrl: "/",
        redirect: true
      })
    } catch (error) {
      console.error("Sign out error:", error)
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.back()
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
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
            Sign out of your account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Are you sure you want to end your secure session?
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-2xl sm:px-10">
          {/* Current Session Info */}
          {session?.user && (
            <div className="mb-6 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {session.user.image ? (
                    <img
                      className="h-10 w-10 rounded-full ring-2 ring-slate-200 dark:ring-slate-600"
                      src={session.user.image}
                      alt={session.user.name || "User avatar"}
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <User className="h-6 w-6 text-slate-500 dark:text-slate-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {session.user.name || "Anonymous User"}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {session.user.email}
                  </div>
                  <div className="flex items-center mt-1 text-xs text-slate-400 dark:text-slate-500">
                    <Clock className="h-3 w-3 mr-1" />
                    <span>Role: {session.user.role}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Warning */}
          <div className="mb-6 rounded-lg bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <Shield className="h-5 w-5 text-amber-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                  Security Notice
                </h3>
                <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                  <p>Your sign-out will be logged for security monitoring purposes.</p>
                  <p className="mt-1">Make sure to close your browser if using a shared computer.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                {loading ? (
                  <Loader2 className="h-5 w-5 text-red-300 animate-spin" />
                ) : (
                  <LogOut className="h-5 w-5 text-red-300 group-hover:text-red-200" />
                )}
              </span>
              {loading ? "Signing out..." : "Yes, sign me out"}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <ArrowLeft className="h-5 w-5 text-slate-400 group-hover:text-slate-500" />
              </span>
              Cancel and go back
            </button>
          </div>

          {/* Security Features */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                What happens when you sign out?
              </h3>
              <div className="space-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-1.5 w-1.5 bg-slate-400 rounded-full"></div>
                  <span>Your session will be terminated securely</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-1.5 w-1.5 bg-slate-400 rounded-full"></div>
                  <span>Sign-out activity will be logged</span>
                </div>
                <div className="flex items-center justify-center space-x-2">
                  <div className="h-1.5 w-1.5 bg-slate-400 rounded-full"></div>
                  <span>You'll need to sign in again to access the dashboard</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}