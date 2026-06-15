'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Search, MessageSquare, ExternalLink, Download, FileText, SlidersHorizontal, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Usuario {
  id: string
  nome: string
  cpf: string
  rg: string
  telefone: string
  whatsapp: string
  data_nascimento: string
  cidade: string
  estado: string
  endereco: string
  numero: string
  bairro: string
  cep: string
  nome_assessor: string
  created_at: string
}

interface TipoAtendimento {
  id: string
  descricao: string
}

const COLUNAS_DISPONIVEIS = [
  { key: 'nome',           label: 'Nome' },
  { key: 'cpf',            label: 'CPF' },
  { key: 'rg',             label: 'RG' },
  { key: 'data_nascimento',label: 'Data Nascimento' },
  { key: 'telefone',       label: 'Telefone' },
  { key: 'whatsapp',       label: 'WhatsApp' },
  { key: 'endereco',       label: 'Endereço' },
  { key: 'numero',         label: 'Número' },
  { key: 'bairro',         label: 'Bairro' },
  { key: 'cep',            label: 'CEP' },
  { key: 'cidade',         label: 'Cidade' },
  { key: 'estado',         label: 'Estado' },
  { key: 'nome_assessor',  label: 'Assessor' },
  { key: 'created_at',     label: 'Cadastrado em' },
]

export default function ConsultarUsuarios() {
  const [busca, setBusca] = useState('')
  const [tipoBusca, setTipoBusca] = useState('nome')
  const [tipoSelecionado, setTipoSelecionado] = useState('')
  const [tipos, setTipos] = useState<TipoAtendimento[]>([])
  const [resultados, setResultados] = useState<Usuario[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscou, setBuscou] = useState(false)
  const [mostrarColunas, setMostrarColunas] = useState(false)
  const [colunasSelecionadas, setColunasSelecionadas] = useState<string[]>([
    'nome', 'cpf', 'data_nascimento', 'telefone', 'bairro', 'cidade', 'nome_assessor'
  ])
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

  async function exportarTodos() {
    toast.loading('Carregando todos os cadastros...')
    const { data, error } = await supabase
      .from('usuarios').select('*').eq('ativo', true).order('nome').limit(10000)
    toast.dismiss()
    if (error || !data) { toast.error('Erro ao carregar cadastros'); return }
    gerarExcel(data, 'todos_cadastros')
  }

  function formatarCPF(cpf: string) {
    return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') || '—'
  }

  function formatarData(data: string) {
    if (!data) return '—'
    return format(new Date(data + 'T00:00:00'), 'dd/MM/yyyy')
  }

  function valorColuna(u: any, key: string): string {
    switch (key) {
      case 'cpf': return formatarCPF(u.cpf)
      case 'data_nascimento': return u.data_nascimento ? formatarData(u.data_nascimento) : '—'
      case 'created_at': return u.created_at ? format(new Date(u.created_at), 'dd/MM/yyyy HH:mm') : '—'
      case 'telefone': return u.telefone || u.whatsapp || '—'
      default: return u[key] || '—'
    }
  }

  function gerarExcel(dados: Usuario[], nomeArquivo: string) {
    if (dados.length === 0) { toast.error('Nenhum dado para exportar'); return }
    const colsLabel = COLUNAS_DISPONIVEIS.filter(c => colunasSelecionadas.includes(c.key))
    const cabecalho = colsLabel.map(c => c.label)
    const linhas = dados.map(u => colsLabel.map(c => valorColuna(u, c.key)))
    const csvContent = [cabecalho, ...linhas]
      .map(row => row.map(cel => `"${String(cel).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${nomeArquivo}_${format(new Date(), 'dd-MM-yyyy_HH-mm')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${dados.length} registros exportados!`)
  }

  function exportarExcel() {
    gerarExcel(resultados, 'cadastros')
  }

  function exportarPDF() {
    if (resultados.length === 0) { toast.error('Nenhum resultado para exportar'); return }
    const cols = COLUNAS_DISPONIVEIS.filter(c => colunasSelecionadas.includes(c.key))
    const cabecalhos = cols.map(c => `<th>${c.label}</th>`).join('')
    const linhas = resultados.map((u, i) => `
      <tr style="background:${i % 2 === 0 ? '#fff' : '#f9f9f9'}">
        <td>${i + 1}</td>
        ${cols.map(c => `<td>${valorColuna(u, c.key)}</td>`).join('')}
      </tr>`).join('')

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório de Cadastros</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 10px; margin: 20px; color: #333; }
  h1 { color: #ea580c; font-size: 16px; margin-bottom: 4px; }
  .info { color: #666; font-size: 10px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #ea580c; color: white; padding: 6px 5px; text-align: left; font-size: 10px; }
  td { padding: 5px; border-bottom: 1px solid #eee; font-size: 10px; }
  .footer { margin-top: 16px; font-size: 9px; color: #999; text-align: center; }
  @media print { body { margin: 8px; } }
</style>
</head>
<body>
<h1>Escritório Danilo Gomes</h1>
<div class="info">
  Relatório de Cadastros · Total: ${resultados.length} registros · Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}
</div>
<table>
  <thead><tr><th>#</th>${cabecalhos}</tr></thead>
  <tbody>${linhas}</tbody>
</table>
<div class="footer">Escritório Danilo Gomes — Guarulhos/SP</div>
<script>window.onload = () => window.print()</script>
</body></html>`

    const win = window.open('', '_blank')
    win?.document.write(html)
    win?.document.close()
  }

  function toggleColuna(key: string) {
    setColunasSelecionadas(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
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

  // Colunas visíveis na tabela (máximo 6 para não quebrar)
  const colunasTabela = COLUNAS_DISPONIVEIS.filter(c => colunasSelecionadas.includes(c.key)).slice(0, 7)

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
                tipoBusca === 'bairro' ? 'Digite o bairro...' : 'Digite rua ou cidade...'
              } />
          )}
          <button onClick={buscar} disabled={buscando}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Search size={16} /> {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Barra de ações: seletor de colunas + exportar todos */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="relative">
          <button
            onClick={() => setMostrarColunas(!mostrarColunas)}
            className={`flex items-center gap-2 border px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              mostrarColunas ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal size={15} />
            Colunas ({colunasSelecionadas.length})
          </button>

          {/* Dropdown de colunas */}
          {mostrarColunas && (
            <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-72">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Selecionar colunas</p>
                <button onClick={() => setMostrarColunas(false)}><X size={14} className="text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {COLUNAS_DISPONIVEIS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1.5 rounded-lg">
                    <input
                      type="checkbox"
                      checked={colunasSelecionadas.includes(col.key)}
                      onChange={() => toggleColuna(col.key)}
                      className="w-3.5 h-3.5 accent-orange-500"
                    />
                    <span className="text-xs text-gray-700">{col.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                <button onClick={() => setColunasSelecionadas(COLUNAS_DISPONIVEIS.map(c => c.key))}
                  className="flex-1 text-xs text-orange-600 hover:underline">Todas</button>
                <button onClick={() => setColunasSelecionadas(['nome', 'cpf', 'data_nascimento', 'telefone', 'bairro', 'cidade', 'nome_assessor'])}
                  className="flex-1 text-xs text-gray-500 hover:underline">Padrão</button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={exportarTodos}
          className="flex items-center gap-2 border border-green-300 text-green-700 hover:bg-green-50 px-3 py-2 rounded-lg text-sm font-medium"
        >
          <Download size={15} /> Exportar todos os cadastros
        </button>
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
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {colunasTabela.map(col => (
                      <th key={col.key} className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase whitespace-nowrap">
                        {col.label}
                      </th>
                    ))}
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((u) => (
                    <tr key={u.id} className="border-b border-gray-50 hover:bg-orange-50 cursor-pointer"
                      onClick={() => router.push(`/consultar/usuario/${u.id}`)}>
                      {colunasTabela.map(col => (
                        <td key={col.key} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {col.key === 'nome'
                            ? <div className="flex items-center gap-1 font-medium text-gray-800">{u.nome} <ExternalLink size={11} className="text-gray-300" /></div>
                            : valorColuna(u, col.key)
                          }
                        </td>
                      ))}
                      <td className="px-4 py-3">
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
