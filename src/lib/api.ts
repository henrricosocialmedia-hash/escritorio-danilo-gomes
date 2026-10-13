// fetch para as rotas /api do sistema, enviando o token do usuário logado

import { supabase } from '@/lib/supabase'

export async function fetchAutenticado(url: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (data.session) {
    headers.set('Authorization', `Bearer ${data.session.access_token}`)
  }
  return fetch(url, { ...init, headers })
}
