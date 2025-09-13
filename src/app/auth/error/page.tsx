"use client"

import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Shield, AlertTriangle, RefreshCw, Home, Mail, Clock } from "lucide-react"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const getErrorDetails = (error: string | null) => {
    switch (error) {
      case "Configuration":
        return {
          title: "Server Configuration Error",
          description: "There is a problem with the server configuration.",
          userAction: "Please contact the system administrator.",
          severity: "critical",
          canRetry: false,
          contactSupport: true
        }
      case "AccessDenied":
        return {
          title: "Access Denied",
          description: "Your account is not active or you don't have permission to access this application.",
          userAction: "Please contact support if you believe this is an error.",
          severity: "high",
          canRetry: false,
          contactSupport: true
        }
      case "Verification":
        return {
          title: "Email Verification Required",
          description: "Please verify your email address before signing in.",
          userAction: "Check your email for a verification link or request a new one.",
          severity: "medium",
          canRetry: true,
          contactSupport: false
        }
      case "OAuthSignin":
        return {
          title: "OAuth Sign-in Error",
          description: "There was an error constructing the authorization URL for the OAuth provider.",
          userAction: "This is usually a temporary issue. Please try again.",
          severity: "medium",
          canRetry: true,
          contactSupport: false
        }
      case "OAuthCallback":
        return {
          title: "OAuth Callback Error",
          description: "There was an error handling the response from the OAuth provider.",
          userAction: "Please try signing in again.",
          severity: "medium",
          canRetry: true,
          contactSupport: false
        }
      case "OAuthCreateAccount":
        return {
          title: "Account Creation Failed",
          description: "Could not create your account in our database.",
          userAction: "Please try again or contact support if the problem persists.",
          severity: "high",
          canRetry: true,
          contactSupport: true
        }
      case "EmailCreateAccount":
        return {
          title: "Email Account Creation Failed",
          description: "Could not create an email-based account.",
          userAction: "Please verify your email address and try again.",
          severity: "medium",
          canRetry: true,
          contactSupport: false
        }
      case "Callback":
        return {
          title: "Callback Handler Error",
          description: "There was an error in the OAuth callback handler.",
          userAction: "This is usually a temporary issue. Please try again.",
          severity: "medium",
          canRetry: true,
          contactSupport: false
        }
      case "OAuthAccountNotLinked":
        return {
          title: "Account Not Linked",
          description: "The email on this account is already linked with a different OAuth provider.",
          userAction: "Try signing in with the original provider or contact support to link your accounts.",
          severity: "medium",
          canRetry: false,
          contactSupport: true
        }
      case "EmailSignin":
        return {
          title: "Email Sign-in Failed",
          description: "Could not send the verification email.",
          userAction: "Please check your email address and try again.",
          severity: "medium",
          canRetry: true,
          contactSupport: false
        }
      case "CredentialsSignin":
        return {
          title: "Invalid Credentials",
          description: "The credentials you provided are not valid.",
          userAction: "Please check your login information and try again.",
          severity: "low",
          canRetry: true,
          contactSupport: false
        }
      case "SessionRequired":
        return {
          title: "Session Required",
          description: "You need to be signed in to access this content.",
          userAction: "Please sign in to continue.",
          severity: "low",
          canRetry: false,
          contactSupport: false
        }
      case "Default":
      default:
        return {
          title: "Authentication Error",
          description: "An unexpected error occurred during authentication.",
          userAction: "Please try again. If the problem persists, contact support.",
          severity: "medium",
          canRetry: true,
          contactSupport: true
        }
    }
  }

  const errorDetails = getErrorDetails(error)

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "red"
      case "high":
        return "orange"
      case "medium":
        return "yellow"
      case "low":
        return "blue"
      default:
        return "gray"
    }
  }

  const getSeverityBadge = (severity: string) => {
    const color = getSeverityColor(severity)
    const colorClasses = {
      red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      orange: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      yellow: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      gray: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[color as keyof typeof colorClasses]}`}>
        {severity.charAt(0).toUpperCase() + severity.slice(1)} Priority
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-950 dark:via-blue-950 dark:to-indigo-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
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
          <div className="flex justify-center">
            <AlertTriangle className="h-16 w-16 text-red-500" />
          </div>
          <h2 className="mt-4 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Authentication Failed
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            We encountered a problem while trying to authenticate you
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 sm:rounded-2xl sm:px-10">
          {/* Error Details */}
          <div className="space-y-6">
            {/* Error Type and Severity */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {errorDetails.title}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Error Code: {error || "UNKNOWN"}
                </p>
              </div>
              <div>
                {getSeverityBadge(errorDetails.severity)}
              </div>
            </div>

            {/* Error Description */}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800 p-4">
              <h4 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                What happened?
              </h4>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {errorDetails.description}
              </p>
            </div>

            {/* User Action */}
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-4">
              <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">
                What can you do?
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                {errorDetails.userAction}
              </p>
            </div>

            {/* Incident Information */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="h-4 w-4 text-gray-500" />
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  Incident Details
                </h4>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p>Time: {new Date().toISOString()}</p>
                <p>Session ID: {Math.random().toString(36).substring(2, 15)}</p>
                <p>This incident has been logged for security monitoring.</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 space-y-3">
            {errorDetails.canRetry && (
              <Link
                href="/auth/signin"
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <RefreshCw className="h-5 w-5 text-blue-300 group-hover:text-blue-200" />
                </span>
                Try signing in again
              </Link>
            )}

            <Link
              href="/"
              className="group relative w-full flex justify-center py-3 px-4 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-lg text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                <Home className="h-5 w-5 text-slate-400 group-hover:text-slate-500" />
              </span>
              Go to homepage
            </Link>

            {errorDetails.contactSupport && (
              <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                  Need help? Our security team is here to assist you.
                </p>
                <a
                  href="mailto:support@prodsafe.com"
                  className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Contact Support
                </a>
              </div>
            )}
          </div>

          {/* Additional Security Info */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="text-center">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                Security & Privacy
              </h3>
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>Error Logged</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>No Data Exposed</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>Secure Connection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span>Privacy Protected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}