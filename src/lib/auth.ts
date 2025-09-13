import { NextAuthConfig } from "next-auth"
import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./db"
import { UserRole, SecurityAction } from "@prisma/client"
import { logSecurityEvent } from "./security"
import { JWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: UserRole
      isActive: boolean
      lastLoginAt: Date | null
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
    role: UserRole
    isActive: boolean
    lastLoginAt: Date | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: UserRole
    isActive: boolean
  }
}

const config: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      authorization: {
        params: {
          scope: "read:user user:email"
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.role = user.role
        token.isActive = user.isActive

        // Update last login time
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() }
        })

        // Log successful login
        await logSecurityEvent({
          userId: user.id,
          action: SecurityAction.LOGIN_SUCCESS,
          details: { provider: "github" }
        })
      }

      // Update session
      if (trigger === "update" && session) {
        token.name = session.user.name
        token.email = session.user.email
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.isActive = token.isActive
        session.user.lastLoginAt = null // Will be fetched separately if needed
      }
      return session
    },

    async signIn({ user, account, profile }) {
      // Check if user is active
      if (user.isActive === false) {
        await logSecurityEvent({
          userId: user.id,
          action: SecurityAction.LOGIN_FAILED,
          details: { reason: "account_inactive" },
          success: false
        })
        return false
      }

      return true
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard')
      const isOnApiRoute = nextUrl.pathname.startsWith('/api')

      // Protect dashboard routes
      if (isOnDashboard) {
        if (!isLoggedIn) return false
        if (!auth.user.isActive) return false
        return true
      }

      // Allow API routes to handle their own auth
      if (isOnApiRoute) {
        return true
      }

      return true
    }
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    signOut: "/auth/signout",
    error: "/auth/error",
  },
  events: {
    async signOut({ token }) {
      if (token?.id) {
        await logSecurityEvent({
          userId: token.id as string,
          action: SecurityAction.LOGOUT
        })
      }
    }
  },
  debug: process.env.NODE_ENV === "development",
}

export const { handlers, auth, signIn, signOut } = NextAuth(config)