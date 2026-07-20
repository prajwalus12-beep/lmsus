import { decryptSession } from '@/lib/session'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Protect all employee routes, ignore /login, /api/auth, static assets, etc.
  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/auth')
  const isStaticFile = request.nextUrl.pathname.match(/\.(.*)$/) && !request.nextUrl.pathname.startsWith('/api')

  if (isAuthPage || isApiRoute || isStaticFile) {
    return response
  }

  try {
    const sessionToken = request.cookies.get('lms-session')?.value
    if (!sessionToken) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const session = decryptSession(sessionToken)
    if (!session || !session.id) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch (err) {
    console.error('Proxy auth check failed:', err)
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}

