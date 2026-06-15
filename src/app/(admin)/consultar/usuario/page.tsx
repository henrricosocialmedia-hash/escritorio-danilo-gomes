'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Search, MessageSquare, ExternalLink, Download, FileText } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Usuario {
  id: string
  nome: string
  cpf: string
  telefone: string
  whatsapp: string
  data_nascimento: string
  cidade: string
  estado: string
  endereco: string
  bairro: string
  nome_assessor: string
  created_at: string
}

interface TipoAtendimento {
  id: string
  descricao: string
}

export default function ConsultarUsuarios() {
  const [busca, setBusca] = useState('')
  const [tipoBusca, setTipoBusca] = useState('nome')
  const [tipoSelecionado, setTipoSelecionado] = useState('')
  const [tipos, setTipos] = useState<TipoAtendimento[]>([])
  const [resultados, setResultados] = useState<Usuario[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscou, setBuscou] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.from('tipos_atendimento').select('id, descricao').eq('ativo', true).order('descricao')
      .then(({ data }) => setTipos(data || []))
  }, [])

  async function buscar() {
    setBuscando(true)
    setBuscou(true)
    let resultadoFinal: Usuario[] = []

    if (tipoBusca === 'tipo_atendimento' && tipoSelecionado) {
      const { data: atendsData } = await supabase
        .from('atendimentos').select('usuario_id').eq('tipo_id', tipoSelecionado)
      const idsUnicos: string[] = []
      const vistos: Record<string, boolean> = {}
      for (const a of (atendsData || [])) {
        if (!vistos[a.usuario_id]) { vistos[a.usuario_id] = true; idsUnicos.push(a.usuario_id) }
      }
      if (idsUnicos.length === 0) { setResultados([]); setBuscando(false); return }
      const { data } = await supabase.from('usuarios').select('*').eq('ativo', true).in('id', idsUnicos).order('nome').limit(200)
      resultadoFinal = data || []
    } else {
      let query = supabase.from('usuarios').select('*').eq('ativo', true).limit(200)
      if (tipoBusca === 'nome' && busca.trim()) query = query.ilike('nome', `%${busca.trim()}%`)
      else if (tipoBusca === 'cpf' && busca.trim()) query = query.ilike('cpf', `%${busca.replace(/\D/g, '')}%`)
      else if (tipoBusca === 'endereco' && busca.trim()) query = query.or(`endereco.ilike.%${busca.trim()}%,cidade.ilike.%${busca.trim()}%`)
      else if (tipoBusca === 'bairro' && busca.trim()) query = query.ilike('bairro', `%${busca.trim()}%`)
      const { data, error } = await query.order('nome')
      if (error) { toast.error('Erro ao buscar'); setBuscando(false); return }
      resultadoFinal = data || []
    }
    setResultados(resultadoFinal)
    setBuscando(false)
  }

  function formatarCPF(cpf: string) {
    return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  // ── Exportar Excel (CSV) ──
  function exportarExcel() {
    if (resultados.length === 0) { toast.error('Nenhum resultado para exportar'); return }
    const cabecalho = ['Nome', 'CPF', 'Data Nascimento', 'Telefone', 'WhatsApp', 'Endereço', 'Número', 'Bairro', 'Cidade', 'Estado', 'CEP', 'Assessor', 'Cadastrado em']
    const linhas = resultados.map(u => [
      u.nome,
      formatarCPF(u.cpf),
      u.data_nascimento ? format(new Date(u.data_nascimento + 'T00:00:00'), 'dd/MM/yyyy') : '',
      u.telefone || '',
      u.whatsapp || '',
      (u as any).endereco || '',
      (u as any).numero || '',
      u.bairro || '',
      u.cidade || '',
      u.estado || '',
      (u as any).cep || '',
      u.nome_assessor || '',
      format(new Date(u.created_at), 'dd/MM/yyyy HH:mm'),
    ])
    const csvContent = [cabecalho, ...linhas]
      .map(row => row.map(cel => `"${String(cel).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cadastros_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${resultados.length} registros exportados!`)
  }

  // ── Exportar PDF (página de impressão) ──
  function exportarPDF() {
    if (resultados.length === 0) { toast.error('Nenhum resultado para exportar'); return }
    const tipoLabel: Record<string, string> = {
      nome: 'Nome', cpf: 'CPF', endereco: 'Endereço', bairro: 'Bairro', tipo_atendimento: 'Tipo de Atendimento'
    }
    const linhas = resultados.map((u, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
        <td>${i + 1}</td>
        <td><strong>${u.nome}</strong></td>
        <td>${formatarCPF(u.cpf)}</td>
        <td>${u.data_nascimento ? format(new Date(u.data_nascimento + 'T00:00:00'), 'dd/MM/yyyy') : '—'}</td>
        <td>${u.telefone || u.whatsapp || '—'}</td>
        <td>${u.bairro || '—'}</td>
        <td>${u.cidade ? u.cidade + '/' + u.estado : '—'}</td>
        <td>${u.nome_assessor || '—'}</td>
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório de Cadastros</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #333; }
  h1 { color: #E87722; font-size: 18px; margin-bottom: 4px; }
  .info { color: #666; font-size: 11px; margin-bottom: 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #E87722; color: white; padding: 8px 6px; text-align: left; font-size: 11px; }
  td { padding: 6px; border-bottom: 1px solid #eee; }
  .footer { margin-top: 16px; font-size: 10px; color: #999; text-align: center; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>Escritório Danilo Gomes</h1>
<div class="info">
  Relatório de Cadastros — Filtro: ${tipoLabel[tipoBusca] || tipoBusca} "${busca || tipoSelecionado}"<br>
  Total: ${resultados.length} registros · Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}
</div>
<table>
  <thead><tr>
    <th>#</th><th>Nome</th><th>CPF</th><th>Nascimento</th>
    <th>Telefone</th><th>Bairro</th><th>Cidade</th><th>Assessor</th>
  </tr></thead>
  <tbody>${linhas}</tbody>
</table>
<div class="footer">Escritório Danilo Gomes — Guarulhos/SP</div>
<script>window.onload = () => window.print()</script>
</body></html>`

    const win = window.open('', '_blank')
    win?.document.write(html)
    win?.document.close()
  }

  async function enviarMensagem(e: React.MouseEvent, usuario: Usuario) {
    e.stopPropagation()
    const numero = usuario.whatsapp || usuario.telefone
    if (!numero) { toast.error('Usuário sem telefone'); return }
    const msg = prompt(`Mensagem para ${usuario.nome.split(' ')[0]}:`)
    if (!msg) return
    const res = await fetch('/api/notificacoes/whatsapp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario_id: usuario.id, telefone: numero, tipo: 'manual', mensagem_template: msg, variaveis: {} }),
    })
    const r = await res.json()
    r.sucesso ? toast.success('Mensagem enviada!') : toast.error(`Erro: ${r.erro}`)
  }

  return (
    <div className="max-w-6xl">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { key: 'nome', label: '👤 Nome' },
            { key: 'cpf', label: '🪪 CPF' },
            { key: 'endereco', label: '📍 Endereço' },
            { key: 'bairro', label: '🏘️ Bairro' },
            { key: 'tipo_atendimento', label: '📋 Tipo de Atendimento' },
          ].map(t => (
            <button key={t.key} onClick={() => { setTipoBusca(t.key); setBusca(''); setTipoSelecionado('') }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tipoBusca === t.key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{t.label}</button>
          ))}
        </div>

        <div className="flex gap-3">
          {tipoBusca === 'tipo_atendimento' ? (
            <select value={tipoSelecionado} onChange={e => setTipoSelecionado(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
              <option value="">Selecione o tipo...</option>
              {tipos.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
            </select>
          ) : (
            <input value={busca} onChange={e => setBusca(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && buscar()}
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder={
                tipoBusca === 'nome' ? 'Digite o nome...' :
                tipoBusca === 'cpf' ? 'Digite o CPF...' :
                tipoBusca === 'bairro' ? 'Digite o bairro...' :
                'Digite rua ou cidade...'
              } />
          )}
          <button onClick={buscar} disabled={buscando}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Search size={16} /> {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Resultados */}
      {buscou && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">{resultados.length} resultado(s)</span>
            {resultados.length > 0 && (
              <div className="flex gap-2">
                <button onClick={exportarExcel}
                  className="flex items-center gap-1.5 border border-green-300 text-green-700 hover:bg-green-50 px-3 py-1.5 rounded-lg text-xs font-medium">
                  <Download size={13} /> Excel/CSV
                </button>
                <button onClick={exportarPDF}
                  className="flex items-center gap-1.5 border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg text-xs font-medium">
                  <FileText size={13} /> PDF
                </button>
              </div>
            )}
          </div>

          {resultados.length === 0 ? (
            <p className="text-center text-gray-400 py-12">Nenhum usuário encontrado</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Nome</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">CPF</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Nascimento</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Telefone</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Bairro</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Cidade</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">Assessor</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {resultados.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-orange-50 cursor-pointer"
                    onClick={() => router.push(`/consultar/usuario/${u.id}`)}>
                    <td className="px-5 py-3 text-sm font-medium text-gray-800">
                      <div className="flex items-center gap-1">{u.nome} <ExternalLink size={11} className="text-gray-300" /></div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{formatarCPF(u.cpf)}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">
                      {u.data_nascimento ? format(new Date(u.data_nascimento + 'T00:00:00'), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-500">{u.telefone || u.whatsapp || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{u.bairro || '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-500">{u.cidade ? `${u.cidade}/${u.estado}` : '—'}</td>
                    <td className="px-5 py-3 text-sm text-gray-400">{u.nome_assessor || '—'}</td>
                    <td className="px-5 py-3">
                      {(u.whatsapp || u.telefone) && (
                        <button onClick={(e) => enviarMensagem(e, u)}
                          className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg">
                          <MessageSquare size={13} /> WA
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
