"use client"

import { useSession, signOut } from "next-auth/react"
import { UserRole } from "@prisma/client"
import {
  Shield,
  Bell,
  Settings,
  User,
  LogOut,
  ChevronDown
} from "lucide-react"
import { useState } from "react"

export function Header() {
  const { data: session } = useSession()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-500/20 text-red-400 border-red-500/30"
      case "SECURITY_LEAD":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      default:
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    }
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[--border-color] bg-[--card-bg]/95 backdrop-blur supports-[backdrop-filter]:bg-[--card-bg]/60">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Logo and Brand */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-[--accent]" />
            <span className="text-xl font-bold">ProdSafe</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-4">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative rounded-lg p-2 text-[--text-muted] hover:bg-[--nav-hover] hover:text-[--foreground] transition-colors"
            >
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full"></span>
            </button>

            {/* Notifications Dropdown */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-[--card-bg] border border-[--card-border] rounded-lg shadow-xl py-2 z-50">
                <div className="px-4 py-2 border-b border-[--card-border]">
                  <h3 className="font-semibold text-sm">Security Alerts</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <div className="px-4 py-3 hover:bg-[--nav-hover] cursor-pointer">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium">Failed Login Attempt</span>
                      <span className="text-xs text-[--text-muted] ml-auto">2m ago</span>
                    </div>
                    <p className="text-xs text-[--text-muted]">Multiple failed login attempts detected from IP 192.168.1.100</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-[--nav-hover] cursor-pointer">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="h-2 w-2 bg-yellow-500 rounded-full"></div>
                      <span className="text-sm font-medium">Rate Limit Warning</span>
                      <span className="text-xs text-[--text-muted] ml-auto">1h ago</span>
                    </div>
                    <p className="text-xs text-[--text-muted]">API rate limit threshold reached for user endpoint</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Menu */}
          {session?.user && (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 rounded-lg p-2 text-[--text-muted] hover:bg-[--nav-hover] hover:text-[--foreground] transition-colors"
              >
                <div className="flex items-center space-x-2">
                  {session.user.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="h-6 w-6 rounded-full"
                    />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                  <span className="text-sm font-medium hidden sm:block">
                    {session.user.name || session.user.email}
                  </span>
                  <span className={`text-xs px-2 py-1 border rounded-full ${getRoleBadgeColor(session.user.role)}`}>
                    {session.user.role}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4" />
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-[--card-bg] border border-[--card-border] rounded-lg shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-[--card-border]">
                    <p className="text-sm font-medium">{session.user.name || "User"}</p>
                    <p className="text-xs text-[--text-muted]">{session.user.email}</p>
                  </div>

                  <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-[--nav-hover] transition-colors">
                    <User className="h-4 w-4 mr-2" />
                    Profile
                  </button>

                  <button className="flex items-center w-full px-4 py-2 text-sm hover:bg-[--nav-hover] transition-colors">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </button>

                  <div className="border-t border-[--card-border] mt-2 pt-2">
                    <button
                      onClick={handleSignOut}
                      className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-[--nav-hover] transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}