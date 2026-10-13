// Cliente Supabase com service role key - USO EXCLUSIVO NO SERVIDOR (API routes)
// Ignora o RLS, então nunca importe este arquivo em componentes 'use client'

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

export function criarSupabaseAdmin(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada')
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Confere o token "Authorization: Bearer <access_token>" enviado pelo navegador
// Retorna o usuário logado, ou null se o token estiver ausente ou inválido
export async function usuarioDaRequisicao(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data, error } = await criarSupabaseAdmin().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
