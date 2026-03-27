'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const email = formData.get('email')
  const password = formData.get('password')

  if (typeof email !== 'string' || email.trim().length === 0 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return redirect('/login?error=' + encodeURIComponent('Please enter a valid email address.'))
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return redirect('/login?error=' + encodeURIComponent('Password must be between 8 and 256 characters.'))
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })

  if (error) {
    return redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  return redirect('/')
}

export async function signup(formData: FormData) {
  const email = formData.get('email')
  const password = formData.get('password')
  const username = formData.get('username')

  if (typeof email !== 'string' || email.trim().length === 0 || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return redirect('/login?error=' + encodeURIComponent('Please enter a valid email address.'))
  }

  if (typeof password !== 'string' || password.length < 8 || password.length > 256) {
    return redirect('/login?error=' + encodeURIComponent('Password must be between 8 and 256 characters.'))
  }

  if (typeof username !== 'string' || username.length < 2 || username.length > 50 || !/^[a-zA-Z0-9_]+$/.test(username)) {
    return redirect('/login?error=' + encodeURIComponent('Username must be 2-50 characters and contain only letters, numbers, and underscores.'))
  }

  const supabase = await createClient()

  const { data: authData, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        username: username,
      },
    },
  })

  if (error) {
    return redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // If email confirmation is disabled, authData.user will be present.
  // We redirect to home. Even if session is not immediately available in the response,
  // the cookie should have been set by createServerClient if the auth was successful.
  if (authData.user) {
    revalidatePath('/', 'layout')
    return redirect('/')
  }

  return redirect('/login?message=' + encodeURIComponent('Signup successful. Please check your email to confirm your account.'))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return redirect('/login')
}
