'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Search, CheckCircle, AlertTriangle, Edit, X, Save } from 'lucide-react'

interface Usuario {
  id: string
  nome: string
  cpf: string
  rg: string
  telefone: string
  whatsapp: string
  data_nascimento: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
  observacao: boolean
}

interface TipoAtendimento { id: string; descricao: string }
interface OrigemAtendimento { id: string; descricao: string }
interface Atendente { id: string; nome: string }

export default function NovoAtendimento() {
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<Usuario[]>([])
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [buscando, setBuscando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [editandoCadastro, setEditandoCadastro] = useState(false)
  const [salvandoCadastro, setSalvandoCadastro] = useState(false)
  const [formEdicao, setFormEdicao] = useState<Partial<Usuario>>({})

  const [tipos, setTipos] = useState<TipoAtendimento[]>([])
  const [origens, setOrigens] = useState<OrigemAtendimento[]>([])
  const [atendentes, setAtendentes] = useState<Atendente[]>([])

  const [tipoId, setTipoId] = useState('')
  const [origemId, setOrigemId] = useState('')
  const [atendenteId, setAtendenteId] = useState('')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    async function carregarOpcoes() {
      const [{ data: t }, { data: o }, { data: a }] = await Promise.all([
        supabase.from('tipos_atendimento').select('id, descricao').eq('ativo', true).order('descricao'),
        supabase.from('origens_atendimento').select('id, descricao').eq('ativo', true).order('descricao'),
        supabase.from('atendentes').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setTipos(t || [])
      setOrigens(o || [])
      setAtendentes(a || [])
    }
    carregarOpcoes()
  }, [])

  async function buscarUsuario() {
    if (!busca.trim()) return
    setBuscando(true)
    setUsuario(null)
    setResultados([])
    setSucesso(false)

    const termo = busca.replace(/\D/g, '')
    let query = supabase.from('usuarios').select('*').eq('ativo', true).limit(20)

    if (termo.length >= 6) {
      query = query.ilike('cpf', `%${termo}%`)
    } else {
      query = query.ilike('nome', `%${busca.trim()}%`).order('nome')
    }

    const { data } = await query
    if (data && data.length === 1) {
      setUsuario(data[0])
      setResultados([])
    } else if (data && data.length > 1) {
      setResultados(data)
    } else {
      toast.error('Usuário não encontrado. Verifique o CPF ou nome.')
    }
    setBuscando(false)
  }

  function selecionarUsuario(u: Usuario) {
    setUsuario(u)
    setResultados([])
    setEditandoCadastro(false)
  }

  function limpar() {
    setUsuario(null)
    setResultados([])
    setBusca('')
    setTipoId('')
    setOrigemId('')
    setAtendenteId('')
    setObservacoes('')
    setSucesso(false)
    setEditandoCadastro(false)
  }

  function abrirEdicao() {
    if (!usuario) return
    setFormEdicao({
      nome: usuario.nome,
      rg: usuario.rg || '',
      telefone: usuario.telefone || '',
      whatsapp: usuario.whatsapp || '',
      data_nascimento: usuario.data_nascimento || '',
      cep: usuario.cep || '',
      endereco: usuario.endereco || '',
      numero: usuario.numero || '',
      complemento: usuario.complemento || '',
      bairro: usuario.bairro || '',
      cidade: usuario.cidade || '',
      estado: usuario.estado || '',
    })
    setEditandoCadastro(true)
  }

  async function buscarCEP(cep: string) {
    const limpo = cep.replace(/\D/g, '')
    if (limpo.length !== 8) return
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`)
      const data = await res.json()
      if (!data.erro) {
        setFormEdicao(f => ({
          ...f,
          endereco: data.logradouro || f.endereco,
          bairro: data.bairro || f.bairro,
          cidade: data.localidade || f.cidade,
          estado: data.uf || f.estado,
        }))
        toast.success('Endereço preenchido!')
      }
    } catch {}
  }

  async function salvarCadastro() {
    if (!usuario) return
    setSalvandoCadastro(true)
    const { error } = await supabase
      .from('usuarios')
      .update({
        nome: formEdicao.nome || usuario.nome,
        rg: formEdicao.rg || null,
        telefone: formEdicao.telefone || null,
        whatsapp: formEdicao.whatsapp || null,
        data_nascimento: formEdicao.data_nascimento || null,
        cep: formEdicao.cep?.replace(/\D/g, '') || null,
        endereco: formEdicao.endereco || null,
        numero: formEdicao.numero || null,
        complemento: formEdicao.complemento || null,
        bairro: formEdicao.bairro || null,
        cidade: formEdicao.cidade || null,
        estado: formEdicao.estado || null,
      })
      .eq('id', usuario.id)

    if (error) {
      toast.error('Erro ao salvar cadastro')
    } else {
      toast.success('Cadastro atualizado!')
      setUsuario(u => u ? { ...u, ...formEdicao } as Usuario : u)
      setEditandoCadastro(false)
    }
    setSalvandoCadastro(false)
  }

  async function registrarAtendimento() {
    if (!usuario) return
    if (!tipoId) { toast.error('Selecione o tipo de atendimento'); return }
    setSalvando(true)
    const { error } = await supabase.from('atendimentos').insert({
      usuario_id: usuario.id,
      atendente_id: atendenteId || null,
      tipo_id: tipoId,
      origem_id: origemId || null,
      observacoes: observacoes || null,
    })
    if (error) {
      toast.error(`Erro ao registrar: ${error.message}`)
    } else {
      setSucesso(true)
      toast.success('Atendimento registrado com sucesso!')
      setTimeout(() => limpar(), 3000)
    }
    setSalvando(false)
  }

  function formatarCPF(cpf: string) {
    return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  function input(label: string, key: keyof Usuario, tipo = 'text') {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        <input
          type={tipo}
          value={(formEdicao[key] as string) || ''}
          onChange={e => setFormEdicao(f => ({ ...f, [key]: e.target.value }))}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>
    )
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <CheckCircle size={56} className="text-green-500" />
        <p className="text-lg font-semibold text-gray-800">Atendimento registrado!</p>
        <p className="text-sm text-gray-400">Preparando para o próximo...</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      {/* Busca */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <p className="text-sm text-gray-500 mb-3">Digite o CPF ou nome do usuário para iniciar o atendimento</p>
        <div className="flex gap-3">
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && buscarUsuario()}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="CPF ou nome do usuário..."
          />
          <button onClick={buscarUsuario} disabled={buscando}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60">
            <Search size={16} /> {buscando ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Lista de resultados */}
      {resultados.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 mb-5 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-xs text-gray-400">{resultados.length} cadastros encontrados — selecione o correto</p>
          </div>
          {resultados.map(u => (
            <button key={u.id} onClick={() => selecionarUsuario(u)}
              className="w-full flex items-center gap-3 px-5 py-3 hover:bg-orange-50 border-b border-gray-50 last:border-0 transition-colors text-left">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${u.observacao ? 'bg-red-500' : 'bg-orange-400'}`}>
                {u.nome.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  {u.nome}
                  {u.observacao && (
                    <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
                      <AlertTriangle size={12} /> OBS
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-400">CPF: {formatarCPF(u.cpf)} · {u.bairro || u.cidade || ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Usuário selecionado */}
      {usuario && (
        <>
          {/* Banner OBSERVAÇÃO */}
          {usuario.observacao && (
            <div className="flex items-center justify-center gap-3 bg-red-600 text-white rounded-xl px-6 py-4 mb-4 shadow-lg">
              <AlertTriangle size={28} className="flex-shrink-0" />
              <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.05em' }}>OBSERVAÇÃO</span>
              <AlertTriangle size={28} className="flex-shrink-0" />
            </div>
          )}

          {/* Card do usuário */}
          <div className={`border rounded-xl p-4 mb-5 ${usuario.observacao ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${usuario.observacao ? 'bg-red-500' : 'bg-orange-500'}`}>
                {usuario.nome.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800">{usuario.nome}</p>
                <p className="text-sm text-gray-500">CPF: {formatarCPF(usuario.cpf)} · {usuario.telefone || usuario.whatsapp || 'Sem telefone'}</p>
                {usuario.endereco && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    📍 {usuario.endereco}{usuario.numero ? `, ${usuario.numero}` : ''} — {usuario.bairro}, {usuario.cidade}/{usuario.estado}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={abrirEdicao}
                  className="flex items-center gap-1.5 border border-orange-300 text-orange-600 hover:bg-orange-100 px-3 py-1.5 rounded-lg text-xs font-medium">
                  <Edit size={12} /> Editar
                </button>
                <button onClick={limpar}
                  className="text-xs text-gray-400 hover:text-gray-600 underline text-center">
                  Trocar
                </button>
              </div>
            </div>
          </div>

          {/* Painel de edição do cadastro */}
          {editandoCadastro && (
            <div className="bg-white rounded-xl border border-orange-200 p-5 mb-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Editar cadastro</h3>
                <button onClick={() => setEditandoCadastro(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                {input('Nome completo', 'nome')}
                {input('RG', 'rg')}
                {input('Telefone', 'telefone')}
                {input('WhatsApp', 'whatsapp')}
                {input('Data de nascimento', 'data_nascimento', 'date')}
              </div>

              <div className="border-t border-gray-100 pt-3 mb-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Endereço</p>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    {input('CEP', 'cep')}
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => buscarCEP(formEdicao.cep || '')}
                      className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg text-xs font-medium mb-0">
                      🔍 Buscar
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {input('Endereço', 'endereco')}
                  {input('Número', 'numero')}
                  {input('Complemento', 'complemento')}
                  {input('Bairro', 'bairro')}
                  {input('Cidade', 'cidade')}
                  {input('Estado', 'estado')}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={salvarCadastro} disabled={salvandoCadastro}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60">
                  <Save size={14} /> {salvandoCadastro ? 'Salvando...' : 'Salvar cadastro'}
                </button>
                <button onClick={() => setEditandoCadastro(false)}
                  className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Formulário de atendimento */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Dados do atendimento</h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Tipo de atendimento *</label>
                <select value={tipoId} onChange={e => setTipoId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Selecione...</option>
                  {tipos.map(t => <option key={t.id} value={t.id}>{t.descricao}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Origem</label>
                <select value={origemId} onChange={e => setOrigemId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                  <option value="">Selecione...</option>
                  {origens.map(o => <option key={o.id} value={o.id}>{o.descricao}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Atendente responsável</label>
              <select value={atendenteId} onChange={e => setAtendenteId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="">Selecione...</option>
                {atendentes.map(a => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Observações</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                placeholder="Detalhes do atendimento..." />
            </div>

            <button onClick={registrarAtendimento} disabled={salvando}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg text-sm font-medium disabled:opacity-60">
              {salvando ? '⏳ Registrando...' : '✅ Registrar atendimento'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
