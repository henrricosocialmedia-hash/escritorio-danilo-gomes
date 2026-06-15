'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { CreditCard, Upload, Printer, Search, ChevronDown, User } from 'lucide-react'

interface Curso {
  id: string
  nome: string
  professor: string
  local: string
  dia_semana: string
  horario_inicio: string
  horario_fim: string
}

interface Aluno {
  id: string
  nome: string
  cpf: string
  rg: string
  data_nascimento: string
  foto_url: string | null
  inscricao_id: string
}

export default function CarteirinhaPage() {
  const [cursos, setCursos] = useState<Curso[]>([])
  const [cursoSelecionado, setCursoSelecionado] = useState<Curso | null>(null)
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingCursos, setLoadingCursos] = useState(true)
  const [busca, setBusca] = useState('')
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [dropdownAberto, setDropdownAberto] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const alunoParaFotoRef = useRef<string | null>(null)

  useEffect(() => {
    carregarCursos()
  }, [])

  async function carregarCursos() {
    const { data } = await supabase
      .from('cursos')
      .select('id, nome, professor, local, dia_semana, horario_inicio, horario_fim')
      .eq('ativo', true)
      .order('nome')
    setCursos(data || [])
    setLoadingCursos(false)
  }

  async function carregarAlunos(curso: Curso) {
    setCursoSelecionado(curso)
    setDropdownAberto(false)
    setLoading(true)
    setAlunos([])

    const { data, error } = await supabase
      .from('inscricoes')
      .select(`
        id,
        usuario_id,
        usuarios (id, nome, cpf, rg, data_nascimento, foto_url)
      `)
      .eq('curso_id', curso.id)
      .eq('status', 'confirmado')

    if (error) {
      toast.error('Erro ao carregar alunos')
      setLoading(false)
      return
    }

    const lista: Aluno[] = (data || []).map((row: any) => ({
      id: row.usuarios.id,
      nome: row.usuarios.nome,
      cpf: row.usuarios.cpf,
      rg: row.usuarios.rg,
      data_nascimento: row.usuarios.data_nascimento,
      foto_url: row.usuarios.foto_url,
      inscricao_id: row.id,
    }))

    setAlunos(lista)
    setLoading(false)
  }

  async function uploadFoto(usuarioId: string, file: File) {
    setUploadingId(usuarioId)
    try {
      const ext = file.name.split('.').pop()
      const path = `fotos-alunos/${usuarioId}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('carteirinhas')
        .upload(path, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('carteirinhas')
        .getPublicUrl(path)

      const { error: updateError } = await supabase
        .from('usuarios')
        .update({ foto_url: urlData.publicUrl })
        .eq('id', usuarioId)

      if (updateError) throw updateError

      setAlunos(prev => prev.map(a =>
        a.id === usuarioId ? { ...a, foto_url: urlData.publicUrl } : a
      ))
      toast.success('Foto atualizada!')
    } catch (err: any) {
      toast.error('Erro ao fazer upload da foto')
    } finally {
      setUploadingId(null)
    }
  }

  function abrirUpload(usuarioId: string) {
    alunoParaFotoRef.current = usuarioId
    fileInputRef.current?.click()
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file && alunoParaFotoRef.current) {
      uploadFoto(alunoParaFotoRef.current, file)
    }
    e.target.value = ''
  }

  function imprimirTodos() {
    const alunosFiltrados = alunos.filter(a =>
      a.nome.toLowerCase().includes(busca.toLowerCase())
    )
    if (alunosFiltrados.length === 0) {
      toast.error('Nenhum aluno para imprimir')
      return
    }
    const ids = alunosFiltrados.map(a => a.id).join(',')
    window.open(`/imprimir-carteirinha?curso_id=${cursoSelecionado?.id}&alunos=${ids}`, '_blank')
  }

  function imprimirAluno(aluno: Aluno) {
    window.open(`/imprimir-carteirinha?curso_id=${cursoSelecionado?.id}&alunos=${aluno.id}`, '_blank')
  }

  const alunosFiltrados = alunos.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase())
  )

  function formatarCPF(cpf: string) {
    if (!cpf) return '-'
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  function calcularIdade(dataNasc: string) {
    if (!dataNasc) return ''
    const hoje = new Date()
    const nasc = new Date(dataNasc)
    let idade = hoje.getFullYear() - nasc.getFullYear()
    const m = hoje.getMonth() - nasc.getMonth()
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--
    return `${idade} anos`
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CreditCard size={20} className="text-orange-500" />
          <p className="text-sm text-gray-400">
            {cursoSelecionado
              ? `${alunosFiltrados.length} aluno(s) — ${cursoSelecionado.nome}`
              : 'Selecione um curso para gerar carteirinhas'}
          </p>
        </div>
        <div className="flex gap-2">
          {cursoSelecionado && alunos.length > 0 && (
            <button
              onClick={imprimirTodos}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
            >
              <Printer size={16} /> Imprimir todas
            </button>
          )}
        </div>
      </div>

      {/* Seletor de curso */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <label className="block text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Curso</label>
        <div className="relative">
          <button
            onClick={() => setDropdownAberto(!dropdownAberto)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-left flex items-center justify-between hover:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <span className={cursoSelecionado ? 'text-gray-800' : 'text-gray-400'}>
              {loadingCursos ? 'Carregando...' : cursoSelecionado ? cursoSelecionado.nome : 'Selecione um curso...'}
            </span>
            <ChevronDown size={16} className="text-gray-400" />
          </button>
          {dropdownAberto && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg max-h-60 overflow-y-auto">
              {cursos.length === 0 ? (
                <p className="px-3 py-3 text-sm text-gray-400">Nenhum curso ativo</p>
              ) : cursos.map(c => (
                <button
                  key={c.id}
                  onClick={() => carregarAlunos(c)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-orange-50 hover:text-orange-700 border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium">{c.nome}</span>
                  <span className="text-gray-400 ml-2">· {c.professor}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Busca */}
      {cursoSelecionado && (
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar aluno..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
      )}

      {/* Input arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Lista de alunos */}
      {loading ? (
        <p className="text-gray-400 text-center py-12">Carregando alunos...</p>
      ) : cursoSelecionado && alunosFiltrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">{busca ? 'Nenhum aluno encontrado' : 'Nenhum aluno inscrito neste curso'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {alunosFiltrados.map(aluno => (
            <div key={aluno.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 hover:border-orange-300 transition-colors">
              {/* Foto */}
              <div className="relative flex-shrink-0">
                <div className="w-16 h-20 rounded-lg border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center">
                  {aluno.foto_url ? (
                    <img src={aluno.foto_url} alt={aluno.nome} className="w-full h-full object-cover" />
                  ) : (
                    <User size={24} className="text-gray-300" />
                  )}
                </div>
                <button
                  onClick={() => abrirUpload(aluno.id)}
                  disabled={uploadingId === aluno.id}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow"
                  title="Trocar foto"
                >
                  {uploadingId === aluno.id ? (
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload size={11} />
                  )}
                </button>
              </div>

              {/* Dados */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-800 truncate">{aluno.nome}</h3>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                  <p className="text-xs text-gray-500">CPF: {formatarCPF(aluno.cpf)}</p>
                  {aluno.rg && <p className="text-xs text-gray-500">RG: {aluno.rg}</p>}
                  {aluno.data_nascimento && (
                    <p className="text-xs text-gray-500">{calcularIdade(aluno.data_nascimento)}</p>
                  )}
                </div>
                <p className="text-xs text-orange-500 mt-1 font-medium">{cursoSelecionado?.nome}</p>
              </div>

              {/* Ações */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => imprimirAluno(aluno)}
                  className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Printer size={13} /> Imprimir
                </button>
                {!aluno.foto_url && (
                  <button
                    onClick={() => abrirUpload(aluno.id)}
                    className="border border-orange-300 text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5"
                  >
                    <Upload size={13} /> Foto
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
