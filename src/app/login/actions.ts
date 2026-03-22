'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for simplicity
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    return redirect('/login?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/', 'layout')
  return redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
      },
    },
  })

  if (error) {
    console.error('Signup error:', error.message)
    return redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // If email confirmation is disabled, authData.user will be present.
  // We redirect to home. Even if session is not immediately available in the response,
  // the cookie should have been set by createServerClient if the auth was successful.
  if (authData.user) {
    revalidatePath('/', 'layout')
    return redirect('/')
  }

  return redirect('/login?error=' + encodeURIComponent('Signup successful. Please log in.'))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  return redirect('/login')
}
