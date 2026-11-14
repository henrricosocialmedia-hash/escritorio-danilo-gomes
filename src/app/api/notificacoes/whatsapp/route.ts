// /api/notificacoes/whatsapp
// Endpoint para enviar mensagem WhatsApp e registrar no log

import { NextRequest, NextResponse } from 'next/server'
import { enviarWhatsApp, montarMensagem } from '@/lib/zapi'
import { criarSupabaseAdmin, usuarioDaRequisicao } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    // Sem isso qualquer pessoa na internet poderia disparar mensagens pelo número da instituição
    if (!(await usuarioDaRequisicao(req))) {
      return NextResponse.json({ erro: 'Não autorizado', sucesso: false }, { status: 401 })
    }

    const body = await req.json()
    const { usuario_id, telefone, tipo, mensagem_template, variaveis } = body

    if (!telefone || !mensagem_template) {
      return NextResponse.json(
        { erro: 'telefone e mensagem_template são obrigatórios' },
        { status: 400 }
      )
    }

    // Monta a mensagem substituindo variáveis
    const mensagem = montarMensagem(mensagem_template, variaveis || {})

    // Envia via Z-API
    const resultado = await enviarWhatsApp(telefone, mensagem)

    // Registra no log independente do resultado
    // (cliente admin: a rota roda no servidor, sem sessão, e o RLS bloquearia o insert)
    await criarSupabaseAdmin().from('notificacoes_log').insert({
      usuario_id: usuario_id || null,
      tipo: tipo || 'manual',
      canal: 'whatsapp',
      numero_destino: telefone,
      mensagem,
      status: resultado.sucesso ? 'enviado' : 'erro',
      erro_detalhe: resultado.erro || null,
    })

    if (!resultado.sucesso) {
      return NextResponse.json(
        { erro: resultado.erro, sucesso: false },
        { status: 500 }
      )
    }

    return NextResponse.json({ sucesso: true, detalhes: resultado.detalhes })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg, sucesso: false }, { status: 500 })
  }
}
