// /api/cron/aniversarios
// Chamado diariamente (via Vercel Cron ou serviço externo como cron-job.org)
// Envia WhatsApp automático para aniversariantes do dia

import { NextRequest, NextResponse } from 'next/server'
import { criarSupabaseAdmin } from '@/lib/supabase-admin'
import { enviarWhatsApp, montarMensagem } from '@/lib/zapi'

// Proteção por secret para evitar chamadas não autorizadas
const CRON_SECRET = process.env.CRON_SECRET || ''

export async function GET(req: NextRequest) {
  // Verifica o token de autorização (a Vercel envia o CRON_SECRET automaticamente)
  // Sem CRON_SECRET configurado a rota fica bloqueada, para ninguém disparar envios em massa
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ erro: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Cliente admin: o cron roda sem usuário logado, e com a anon key o RLS
    // devolveria as tabelas vazias (o envio nunca acontecia)
    const supabase = criarSupabaseAdmin()

    // Busca configurações
    const { data: configs } = await supabase
      .from('configuracoes')
      .select('chave, valor')
      .in('chave', ['enviar_wa_aniversario', 'msg_aniversario'])

    const configMap: Record<string, string> = {}
    configs?.forEach((c) => { configMap[c.chave] = c.valor })

    if (configMap['enviar_wa_aniversario'] !== 'true') {
      return NextResponse.json({ msg: 'Envio de aniversário desativado', enviados: 0 })
    }

    const template = configMap['msg_aniversario'] || 'Feliz aniversário, {nome}! 🎂'

    // Busca aniversariantes de hoje, no horário de Brasília (o servidor roda em UTC)
    const [, mesHoje, diaHoje] = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()).split('-')

    const { data: aniversariantes } = await supabase
      .from('usuarios')
      .select('id, nome, whatsapp, telefone, data_nascimento')
      .eq('ativo', true)
      .not('whatsapp', 'is', null)

    // Filtra aniversariantes do dia (dia e mês)
    const hoje_aniversariantes = (aniversariantes || []).filter((u) => {
      const [, mes, dia] = u.data_nascimento.split('-')
      return mes === mesHoje && dia === diaHoje
    })

    let enviados = 0
    const erros: string[] = []

    for (const usuario of hoje_aniversariantes) {
      const numero = usuario.whatsapp || usuario.telefone
      if (!numero) continue

      const mensagem = montarMensagem(template, { nome: usuario.nome.split(' ')[0] })
      const resultado = await enviarWhatsApp(numero, mensagem)

      await supabase.from('notificacoes_log').insert({
        usuario_id: usuario.id,
        tipo: 'aniversario',
        canal: 'whatsapp',
        numero_destino: numero,
        mensagem,
        status: resultado.sucesso ? 'enviado' : 'erro',
        erro_detalhe: resultado.erro || null,
      })

      if (resultado.sucesso) {
        enviados++
      } else {
        erros.push(`${usuario.nome}: ${resultado.erro}`)
      }

      // Aguarda 1.5s entre envios para não bloquear o número
      await new Promise((r) => setTimeout(r, 1500))
    }

    return NextResponse.json({
      sucesso: true,
      total_aniversariantes: hoje_aniversariantes.length,
      enviados,
      erros,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ erro: msg }, { status: 500 })
  }
}
