"use client"

import { useSession } from "next-auth/react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { UserRole } from "@prisma/client"
import {
  LayoutDashboard,
  Shield,
  Users,
  Settings,
  Activity,
  AlertTriangle,
  FileText,
  Lock,
  Eye,
  Database,
  BarChart3,
  UserCheck
} from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  badge?: string
}

const navigation: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: ["USER", "ADMIN", "SECURITY_LEAD"]
  },
  {
    name: "Security Overview",
    href: "/dashboard/security",
    icon: Shield,
    roles: ["ADMIN", "SECURITY_LEAD"]
  },
  {
    name: "Activity Monitor",
    href: "/dashboard/activity",
    icon: Activity,
    roles: ["ADMIN", "SECURITY_LEAD"]
  },
  {
    name: "Threat Detection",
    href: "/dashboard/threats",
    icon: AlertTriangle,
    roles: ["SECURITY_LEAD"],
    badge: "3"
  },
  {
    name: "Audit Logs",
    href: "/dashboard/logs",
    icon: FileText,
    roles: ["ADMIN", "SECURITY_LEAD"]
  },
  {
    name: "Access Control",
    href: "/dashboard/access",
    icon: Lock,
    roles: ["ADMIN", "SECURITY_LEAD"]
  },
  {
    name: "User Management",
    href: "/dashboard/users",
    icon: Users,
    roles: ["ADMIN"]
  },
  {
    name: "System Health",
    href: "/dashboard/health",
    icon: BarChart3,
    roles: ["ADMIN", "SECURITY_LEAD"]
  },
  {
    name: "Monitoring",
    href: "/dashboard/monitoring",
    icon: Eye,
    roles: ["SECURITY_LEAD"]
  },
  {
    name: "Data Protection",
    href: "/dashboard/data",
    icon: Database,
    roles: ["SECURITY_LEAD"]
  },
  {
    name: "Profile",
    href: "/dashboard/profile",
    icon: UserCheck,
    roles: ["USER", "ADMIN", "SECURITY_LEAD"]
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    roles: ["USER", "ADMIN", "SECURITY_LEAD"]
  }
]

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const { data: session } = useSession()
  const pathname = usePathname()

  const userRole = session?.user?.role || "USER"
  const filteredNavigation = navigation.filter(item =>
    item.roles.includes(userRole)
  )

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-[--sidebar-bg] border-r border-[--border-color] transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-3 py-6">
            <div className="mb-8 px-3">
              <h2 className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">
                Navigation
              </h2>
            </div>

            {filteredNavigation.map((item) => {
              const active = isActive(item.href)
              const Icon = item.icon

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "nav-item group flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium",
                    active
                      ? "bg-[--primary] text-white shadow-sm"
                      : "text-[--text-muted] hover:text-[--foreground]"
                  )}
                >
                  <div className="flex items-center">
                    <Icon
                      className={cn(
                        "mr-3 h-5 w-5 flex-shrink-0",
                        active ? "text-white" : "text-[--text-muted] group-hover:text-[--foreground]"
                      )}
                    />
                    {item.name}
                  </div>

                  {item.badge && (
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                      active
                        ? "bg-white/20 text-white"
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User info */}
          {session?.user && (
            <div className="border-t border-[--border-color] p-4">
              <div className="flex items-center space-x-3">
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || "User"}
                    className="h-8 w-8 rounded-full"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[--primary] flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {session.user.name?.charAt(0) || session.user.email.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[--foreground] truncate">
                    {session.user.name || "User"}
                  </p>
                  <p className="text-xs text-[--text-muted] capitalize">
                    {session.user.role.toLowerCase()}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}