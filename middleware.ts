import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  if (pathname === '/admin/signup' || pathname.startsWith('/admin/signup/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('signup', 'disabled')
    return NextResponse.redirect(url)
  }

  // Routes that don't require an active session
  const isPublicAdminPath =
    pathname === '/admin/login' ||
    pathname === '/admin/confirm-pending' ||
    pathname === '/admin/access-denied'

  if (!user && !isPublicAdminPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(url)
  }

  // Redirect email/password users who haven't confirmed their address yet.
  // OAuth users always have email_confirmed_at set by the provider.
  if (user && !user.email_confirmed_at && !isPublicAdminPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/admin/confirm-pending'
    return NextResponse.redirect(url)
  }

  if (user) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, is_approved')
      .eq('id', user.id)
      .single()

    const isAdminRole =
      profile?.role === 'superadmin' || profile?.role === 'tournament_admin'
    const isApproved = profile?.is_approved === true
    const isAuthorizedAdmin = isAdminRole && isApproved

    if (!isAuthorizedAdmin && !isPublicAdminPath) {
      const url = request.nextUrl.clone()
      url.pathname = '/admin/access-denied'
      url.search = ''
      return NextResponse.redirect(url)
    }

    if (pathname === '/admin/login') {
      const redirectPath = isAuthorizedAdmin ? safeNextPath(request) : '/admin/access-denied'
      return NextResponse.redirect(new URL(redirectPath, request.url))
    }
  }

  return response
}

function safeNextPath(request: NextRequest) {
  const nextPath = request.nextUrl.searchParams.get('next')
  if (!nextPath || !nextPath.startsWith('/admin')) return '/admin'
  if (nextPath.startsWith('/admin/login') || nextPath.startsWith('/admin/signup')) return '/admin'
  if (nextPath.startsWith('//') || nextPath.includes('://')) return '/admin'
  return nextPath
}

export const config = {
  matcher: ['/admin/:path*'],
}
