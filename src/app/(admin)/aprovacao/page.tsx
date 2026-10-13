'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAutenticado } from '@/lib/api'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { CheckCircle, XCircle, Clock } from 'lucide-react'

interface Solicitacao {
  id: string
  nome: string
  email: string
  telefone: string
  status: string
  senha_temp: string
  created_at: string
}

export default function AprovacaoAcessos() {
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [loading, setLoading] = useState(true)
  const [processando, setProcessando] = useState<string | null>(null)

  useEffect(() => { carregar() }, [])

  async function carregar() {
    const { data } = await supabase
      .from('solicitacoes_acesso')
      .select('*')
      .order('created_at', { ascending: false })
    setSolicitacoes((data || []) as Solicitacao[])
    setLoading(false)
  }

  async function aprovar(sol: Solicitacao) {
    if (!confirm(`Aprovar acesso para ${sol.nome}?`)) return
    setProcessando(sol.id)

    try {
      // Cria o usuário no Supabase Auth
      const res = await fetchAutenticado('/api/admin/criar-usuario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sol.email, senha: sol.senha_temp, nome: sol.nome }),
      })
      const resultado = await res.json()
      if (!resultado.sucesso) {
        toast.error(`Erro ao criar usuário: ${resultado.erro}`)
        setProcessando(null)
        return
      }

      // Atualiza status
      await supabase.from('solicitacoes_acesso').update({
        status: 'aprovado',
        updated_at: new Date().toISOString(),
      }).eq('id', sol.id)

      // A senha já foi usada para criar o acesso; não deixa guardada em texto puro
      await supabase.from('solicitacoes_acesso').update({ senha_temp: null }).eq('id', sol.id)

      // Cadastra como atendente
      await supabase.from('atendentes').upsert({
        nome: sol.nome,
        email: sol.email,
        telefone: sol.telefone || null,
        ativo: true,
      }, { onConflict: 'email' })

      toast.success(`${sol.nome} aprovado! Já pode fazer login.`)
      carregar()
    } catch {
      toast.error('Erro ao aprovar. Tente novamente.')
    }
    setProcessando(null)
  }

  async function reprovar(sol: Solicitacao) {
    if (!confirm(`Reprovar solicitação de ${sol.nome}?`)) return
    setProcessando(sol.id)

    await supabase.from('solicitacoes_acesso').update({
      status: 'reprovado',
      updated_at: new Date().toISOString(),
    }).eq('id', sol.id)
    await supabase.from('solicitacoes_acesso').update({ senha_temp: null }).eq('id', sol.id)

    toast.success('Solicitação reprovada')
    setProcessando(null)
    carregar()
  }

  const pendentes = solicitacoes.filter(s => s.status === 'pendente')
  const processadas = solicitacoes.filter(s => s.status !== 'pendente')

  const statusBadge = (status: string) => {
    if (status === 'aprovado') return <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full"><CheckCircle size={12} /> Aprovado</span>
    if (status === 'reprovado') return <span className="flex items-center gap-1 text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full"><XCircle size={12} /> Reprovado</span>
    return <span className="flex items-center gap-1 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full"><Clock size={12} /> Pendente</span>
  }

  return (
    <div className="max-w-3xl">
      {/* Pendentes */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">Solicitações pendentes</h2>
          {pendentes.length > 0 && (
            <span className="bg-orange-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {pendentes.length}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-10">Carregando...</p>
        ) : pendentes.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Nenhuma solicitação pendente</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendentes.map(sol => (
              <div key={sol.id} className="px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{sol.nome}</p>
                  <p className="text-sm text-gray-400">{sol.email}</p>
                  {sol.telefone && <p className="text-sm text-gray-400">{sol.telefone}</p>}
                  <p className="text-xs text-gray-300 mt-1">
                    Solicitado em {format(new Date(sol.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => reprovar(sol)}
                    disabled={processando === sol.id}
                    className="flex items-center gap-1 border border-red-200 text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    <XCircle size={15} /> Reprovar
                  </button>
                  <button
                    onClick={() => aprovar(sol)}
                    disabled={processando === sol.id}
                    className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                  >
                    <CheckCircle size={15} /> {processando === sol.id ? 'Processando...' : 'Aprovar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico */}
      {processadas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Histórico</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-5 py-3">Nome</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-5 py-3">E-mail</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-5 py-3">Data</th>
                <th className="text-left text-xs font-medium text-gray-400 uppercase px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {processadas.map(sol => (
                <tr key={sol.id} className="border-b border-gray-50">
                  <td className="px-5 py-3 text-sm text-gray-800">{sol.nome}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{sol.email}</td>
                  <td className="px-5 py-3 text-sm text-gray-400">{format(new Date(sol.created_at), 'dd/MM/yyyy')}</td>
                  <td className="px-5 py-3">{statusBadge(sol.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
