// /api/admin/criar-usuario
// Cria usuário no Supabase Auth quando admin aprova uma solicitação

import { NextRequest, NextResponse } from 'next/server'
import { criarSupabaseAdmin, usuarioDaRequisicao } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    // Só quem já está logado no sistema pode criar novos acessos
    if (!(await usuarioDaRequisicao(req))) {
      return NextResponse.json({ sucesso: false, erro: 'Não autorizado' }, { status: 401 })
    }

    const { email, senha, nome } = await req.json()

    if (!email || !senha || !nome) {
      return NextResponse.json({ sucesso: false, erro: 'Dados incompletos' }, { status: 400 })
    }

    // Usa a service role key para criar usuários (nunca exposta ao cliente)
    const supabaseAdmin = criarSupabaseAdmin()

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: senha,
      email_confirm: true, // confirma automaticamente sem precisar de e-mail
      user_metadata: { nome },
    })

    if (error) {
      return NextResponse.json({ sucesso: false, erro: error.message }, { status: 400 })
    }

    return NextResponse.json({ sucesso: true, usuario_id: data.user?.id })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 })
  }
}
