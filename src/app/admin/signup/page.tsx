import { redirect } from 'next/navigation'

export default function AdminSignupPage() {
  redirect('/admin/login?signup=disabled')
}
