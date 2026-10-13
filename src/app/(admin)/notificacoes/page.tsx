'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAutenticado } from '@/lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { RefreshCw, MessageSquare, Send } from 'lucide-react'

interface LogNotif {
  id: string
  tipo: string
  canal: string
  numero_destino: string
  mensagem: string
  status: string
  erro_detalhe: string
  created_at: string
  usuarios: { nome: string }
}

interface Config { chave: string; valor: string }

export default function Notificacoes() {
  const [status, setStatus] = useState<{ conectado: boolean; status?: string } | null>(null)
  const [logs, setLogs] = useState<LogNotif[]>([])
  const [configs, setConfigs] = useState<Record<string, string>>({})
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [loading, setLoading] = useState(true)

  // Para envio manual
  const [telefoneManual, setTelefoneManual] = useState('')
  const [msgManual, setMsgManual] = useState('')
  const [enviandoManual, setEnviandoManual] = useState(false)

  useEffect(() => {
    carregarTudo()
  }, [])

  async function carregarTudo() {
    setLoading(true)
    const [statusRes, { data: logsData }, { data: configsData }] = await Promise.all([
      fetch('/api/notificacoes/status').then(r => r.json()),
      supabase.from('notificacoes_log')
        .select('*, usuarios(nome)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('configuracoes').select('chave, valor')
        .in('chave', ['msg_boas_vindas', 'msg_aniversario', 'enviar_wa_cadastro', 'enviar_wa_aniversario']),
    ])

    setStatus(statusRes)
    setLogs((logsData || []) as unknown as LogNotif[])

    const map: Record<string, string> = {}
    ;(configsData as Config[] || []).forEach(c => { map[c.chave] = c.valor })
    setConfigs(map)
    setLoading(false)
  }

  async function salvarConfig(chave: string, valor: string) {
    setSalvandoConfig(true)
    await supabase.from('configuracoes').update({ valor }).eq('chave', chave)
    setConfigs(p => ({ ...p, [chave]: valor }))
    toast.success('Configuração salva!')
    setSalvandoConfig(false)
  }

  async function enviarManual() {
    if (!telefoneManual || !msgManual) { toast.error('Preencha telefone e mensagem'); return }
    setEnviandoManual(true)

    const res = await fetchAutenticado('/api/notificacoes/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefone: telefoneManual,
        tipo: 'manual',
        mensagem_template: msgManual,
        variaveis: {},
      }),
    })

    const r = await res.json()
    if (r.sucesso) {
      toast.success('Mensagem enviada!')
      setTelefoneManual('')
      setMsgManual('')
      carregarTudo()
    } else {
      toast.error(`Erro: ${r.erro}`)
    }
    setEnviandoManual(false)
  }

  const tipoLabel: Record<string, string> = {
    cadastro: '🆕 Cadastro', aniversario: '🎂 Aniversário', manual: '✉️ Manual',
  }

  return (
    <div className="max-w-4xl space-y-5">
      {/* Status Z-API */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Status Z-API</h2>
          <button onClick={carregarTudo}
            className="text-gray-400 hover:text-orange-500 p-1.5 rounded-lg hover:bg-orange-50">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status?.conectado ? 'bg-green-500' : 'bg-red-400'}`} />
          <span className="text-sm font-medium text-gray-800">
            {status === null ? 'Verificando...' : status.conectado ? 'WhatsApp conectado' : 'Desconectado — verifique a instância Z-API'}
          </span>
        </div>
      </div>

      {/* Configurações das mensagens */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Mensagens automáticas</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Enviar ao cadastrar novo usuário</p>
              <p className="text-xs text-gray-400">Dispara imediatamente após o cadastro</p>
            </div>
            <input type="checkbox"
              checked={configs['enviar_wa_cadastro'] === 'true'}
              onChange={e => salvarConfig('enviar_wa_cadastro', e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 accent-orange-500" />
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="text-sm font-medium text-gray-800">Enviar parabéns no aniversário</p>
              <p className="text-xs text-gray-400">Todos os dias às 08h (via cron)</p>
            </div>
            <input type="checkbox"
              checked={configs['enviar_wa_aniversario'] === 'true'}
              onChange={e => salvarConfig('enviar_wa_aniversario', e.target.checked ? 'true' : 'false')}
              className="w-4 h-4 accent-orange-500" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensagem de boas-vindas <span className="text-xs text-gray-400 font-normal">· use {'{nome}'} para o primeiro nome</span>
            </label>
            <textarea
              value={configs['msg_boas_vindas'] || ''}
              onChange={e => setConfigs(p => ({ ...p, msg_boas_vindas: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            <button onClick={() => salvarConfig('msg_boas_vindas', configs['msg_boas_vindas'])}
              disabled={salvandoConfig}
              className="mt-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60">
              Salvar mensagem
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mensagem de aniversário <span className="text-xs text-gray-400 font-normal">· use {'{nome}'} para o primeiro nome</span>
            </label>
            <textarea
              value={configs['msg_aniversario'] || ''}
              onChange={e => setConfigs(p => ({ ...p, msg_aniversario: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            <button onClick={() => salvarConfig('msg_aniversario', configs['msg_aniversario'])}
              disabled={salvandoConfig}
              className="mt-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg text-xs font-medium disabled:opacity-60">
              Salvar mensagem
            </button>
          </div>
        </div>
      </div>

      {/* Envio manual */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          <MessageSquare size={14} className="inline mr-1" /> Envio manual
        </h2>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefone / WhatsApp</label>
            <input value={telefoneManual} onChange={e => setTelefoneManual(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="(11) 99999-9999" />
          </div>
          <div className="flex items-end">
            <button onClick={enviarManual} disabled={enviandoManual}
              className="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-60">
              <Send size={15} /> {enviandoManual ? 'Enviando...' : 'Enviar WhatsApp'}
            </button>
          </div>
        </div>
        <textarea value={msgManual} onChange={e => setMsgManual(e.target.value)}
          rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
          placeholder="Mensagem a enviar..." />
      </div>

      {/* Log */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Histórico de envios</h2>
        </div>
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Carregando...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Nenhum envio registrado ainda</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                {['Tipo', 'Usuário', 'Número', 'Status', 'Data/Hora'].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-gray-400 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{tipoLabel[l.tipo] || l.tipo}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{l.usuarios?.nome || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{l.numero_destino}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      l.status === 'enviado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {l.status === 'enviado' ? '✓ Enviado' : '✗ Erro'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                    {format(new Date(l.created_at), 'dd/MM/yyyy HH:mm')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
