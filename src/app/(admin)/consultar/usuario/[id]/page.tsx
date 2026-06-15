'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { buscarCEP, formatarCEP } from '@/lib/viacep'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, MessageSquare, Trash2, AlertTriangle } from 'lucide-react'

interface Usuario {
  id: string
  nome: string
  cpf: string
  rg: string
  data_nascimento: string
  titulo_eleitoral: string
  telefone: string
  whatsapp: string
  cep: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  ativo: boolean
  observacao: boolean
}

interface Atendimento {
  id: string
  data_atendimento: string
  observacoes: string
  tipos_atendimento: { descricao: string }
  atendentes: { nome: string }
}

export default function UsuarioDetalhe({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [atendimentos, setAtendimentos] = useState<Atendimento[]>([])
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [editando, setEditando] = useState(false)
  const [togglingObs, setTogglingObs] = useState(false)

  useEffect(() => {
    carregarUsuario()
  }, [params.id])

  async function carregarUsuario() {
    setLoading(true)
    const [{ data: u }, { data: a }] = await Promise.all([
      supabase.from('usuarios').select('*').eq('id', params.id).single(),
      supabase.from('atendimentos')
        .select('id, data_atendimento, observacoes, tipos_atendimento(descricao), atendentes(nome)')
        .eq('usuario_id', params.id)
        .order('data_atendimento', { ascending: false })
        .limit(20),
    ])
    if (u) setUsuario(u)
    setAtendimentos((a || []) as unknown as Atendimento[])
    setLoading(false)
  }

  async function toggleObservacao() {
    if (!usuario) return
    const novoValor = !usuario.observacao
    const confirmMsg = novoValor
      ? 'Ativar observação neste cadastro?'
      : 'Remover observação deste cadastro?'
    if (!confirm(confirmMsg)) return
    setTogglingObs(true)
    const { error } = await supabase
      .from('usuarios')
      .update({ observacao: novoValor })
      .eq('id', usuario.id)
    if (error) {
      toast.error('Erro ao atualizar observação')
    } else {
      setUsuario(u => u ? { ...u, observacao: novoValor } : u)
      toast.success(novoValor ? 'Observação ativada' : 'Observação removida')
    }
    setTogglingObs(false)
  }

  async function salvar() {
    if (!usuario) return
    setSalvando(true)
    const { error } = await supabase
      .from('usuarios')
      .update({
        nome: usuario.nome,
        rg: usuario.rg || null,
        data_nascimento: usuario.data_nascimento || null,
        titulo_eleitoral: usuario.titulo_eleitoral || null,
        telefone: usuario.telefone || null,
        whatsapp: usuario.whatsapp || null,
        cep: usuario.cep?.replace(/\D/g, '') || null,
        endereco: usuario.endereco || null,
        numero: usuario.numero || null,
        complemento: usuario.complemento || null,
        bairro: usuario.bairro || null,
        cidade: usuario.cidade || null,
        estado: usuario.estado || null,
      })
      .eq('id', usuario.id)
    if (error) {
      toast.error(`Erro ao salvar: ${error.message}`)
    } else {
      toast.success('Cadastro atualizado!')
      setEditando(false)
    }
    setSalvando(false)
  }

  async function handleBuscarCEP() {
    if (!usuario?.cep) return
    setBuscandoCEP(true)
    const resultado = await buscarCEP(usuario.cep)
    setBuscandoCEP(false)
    if (resultado.sucesso && resultado.endereco) {
      const { logradouro, bairro, localidade, uf } = resultado.endereco
      setUsuario(u => u ? { ...u, endereco: logradouro, bairro, cidade: localidade, estado: uf } : u)
      toast.success('Endereço preenchido!')
    } else {
      toast.error('CEP não encontrado')
    }
  }

  async function enviarWhatsApp() {
    const numero = usuario?.whatsapp || usuario?.telefone
    if (!numero) { toast.error('Sem telefone cadastrado'); return }
    const msg = prompt(`Mensagem para ${usuario?.nome.split(' ')[0]}:`)
    if (!msg) return
    const res = await fetch('/api/notificacoes/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: usuario?.id,
        telefone: numero,
        tipo: 'manual',
        mensagem_template: msg,
        variaveis: {},
      }),
    })
    const r = await res.json()
    r.sucesso ? toast.success('Mensagem enviada!') : toast.error(`Erro: ${r.erro}`)
  }

  async function desativar() {
    if (!confirm('Desativar este usuário?')) return
    await supabase.from('usuarios').update({ ativo: false }).eq('id', params.id)
    toast.success('Usuário desativado')
    router.back()
  }

  function campo(label: string, campo: keyof Usuario, tipo: string = 'text') {
    return (
      <div>
        <label className="block text-xs text-gray-500 mb-1">{label}</label>
        {editando ? (
          <input
            type={tipo}
            value={(usuario?.[campo] as string) || ''}
            onChange={e => setUsuario(u => u ? { ...u, [campo]: e.target.value } : u)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        ) : (
          <p className="text-sm text-gray-800 py-2 border-b border-gray-100">
            {(usuario?.[campo] as string) || <span className="text-gray-300">—</span>}
          </p>
        )}
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Carregando...</div>
  if (!usuario) return <div className="text-center py-12 text-gray-400">Usuário não encontrado</div>

  function formatarCPF(cpf: string) {
    return cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  return (
    <div className="max-w-3xl">

      {/* ⚠️ BANNER OBSERVAÇÃO */}
      {usuario.observacao && (
        <div className="flex items-center justify-center gap-3 bg-red-600 text-white rounded-xl px-6 py-4 mb-5 shadow-lg">
          <AlertTriangle size={28} className="flex-shrink-0" />
          <span style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '0.05em' }}>
            OBSERVAÇÃO
          </span>
          <AlertTriangle size={28} className="flex-shrink-0" />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Voltar
        </button>
        <div className="flex items-center gap-2">
          {/* Botão observação */}
          <button
            onClick={toggleObservacao}
            disabled={togglingObs}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors disabled:opacity-60 ${
              usuario.observacao
                ? 'bg-red-50 border-red-300 text-red-600 hover:bg-red-100'
                : 'border-gray-300 text-gray-500 hover:bg-gray-50'
            }`}
          >
            <AlertTriangle size={15} />
            {usuario.observacao ? 'Remover observação' : 'Marcar observação'}
          </button>

          {(usuario.whatsapp || usuario.telefone) && (
            <button onClick={enviarWhatsApp}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <MessageSquare size={15} /> WhatsApp
            </button>
          )}
          {editando ? (
            <>
              <button onClick={() => setEditando(false)}
                className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-60">
                <Save size={15} /> {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditando(true)}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
                ✏️ Editar
              </button>
              <button onClick={desativar}
                className="text-red-500 hover:bg-red-50 p-2 rounded-lg">
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dados pessoais */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 ${
            usuario.observacao ? 'bg-red-500' : 'bg-orange-500'
          }`}>
            {usuario.nome.charAt(0)}
          </div>
          <div>
            <h2 className="font-semibold text-gray-800">{usuario.nome}</h2>
            <p className="text-sm text-gray-400">CPF: {formatarCPF(usuario.cpf)}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {usuario.observacao && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-600 flex items-center gap-1">
                <AlertTriangle size={11} /> Observação
              </span>
            )}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${usuario.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
              {usuario.ativo ? '● Ativo' : '○ Inativo'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          {campo('Nome completo', 'nome')}
          {campo('RG', 'rg')}
          {campo('Data de nascimento', 'data_nascimento', 'date')}
          {campo('Título eleitoral', 'titulo_eleitoral')}
          {campo('Telefone', 'telefone')}
          {campo('WhatsApp', 'whatsapp')}
        </div>
      </div>

      {/* Endereço */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Endereço</h3>
        {editando && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">CEP</label>
              <input
                value={usuario.cep ? formatarCEP(usuario.cep) : ''}
                onChange={e => setUsuario(u => u ? { ...u, cep: e.target.value.replace(/\D/g, '') } : u)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="00000-000"
                maxLength={9}
              />
            </div>
            <div className="flex items-end">
              <button onClick={handleBuscarCEP} disabled={buscandoCEP}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                {buscandoCEP ? 'Buscando...' : '🔍 Buscar CEP'}
              </button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          {!editando && campo('CEP', 'cep')}
          {campo('Endereço', 'endereco')}
          {campo('Número', 'numero')}
          {campo('Complemento', 'complemento')}
          {campo('Bairro', 'bairro')}
          {campo('Cidade', 'cidade')}
          {campo('Estado', 'estado')}
        </div>
      </div>

      {/* Histórico de atendimentos */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
          Histórico de atendimentos ({atendimentos.length})
        </h3>
        {atendimentos.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Nenhum atendimento registrado</p>
        ) : (
          <div className="space-y-3">
            {atendimentos.map(a => (
              <div key={a.id} className="flex items-start justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {a.tipos_atendimento?.descricao || 'Sem tipo'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(a.data_atendimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {a.atendentes?.nome && ` · ${a.atendentes.nome}`}
                  </p>
                  {a.observacoes && <p className="text-xs text-gray-500 mt-1">{a.observacoes}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
