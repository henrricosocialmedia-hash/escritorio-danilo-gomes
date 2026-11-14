'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { fetchAutenticado } from '@/lib/api'
import { buscarCEP, formatarCEP, formatarCPF, formatarTelefone } from '@/lib/viacep'

type FormData = {
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
  enviar_wa: boolean
}

export default function CadastrarUsuario() {
  const [buscandoCEP, setBuscandoCEP] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [nomeAssessor, setNomeAssessor] = useState('')
  const [userEmail, setUserEmail] = useState('')

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { enviar_wa: true }
  })

  const cepValue = watch('cep')

  // Pega o usuário logado
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserEmail(data.user.email || '')
        // Busca nome do assessor na tabela de atendentes pelo email
        supabase.from('atendentes')
          .select('nome')
          .eq('email', data.user.email)
          .single()
          .then(({ data: atendente }) => {
            if (atendente) setNomeAssessor(atendente.nome)
            else setNomeAssessor(data.user?.email?.split('@')[0] || 'Sistema')
          })
      }
    })
  }, [])

  async function handleBuscarCEP() {
    const cep = cepValue?.replace(/\D/g, '')
    if (!cep || cep.length < 8) { toast.error('Digite um CEP válido'); return }
    setBuscandoCEP(true)
    const resultado = await buscarCEP(cep)
    setBuscandoCEP(false)
    if (!resultado.sucesso || !resultado.endereco) { toast.error(resultado.erro || 'CEP não encontrado'); return }
    const { logradouro, bairro, localidade, uf } = resultado.endereco
    setValue('endereco', logradouro)
    setValue('bairro', bairro)
    setValue('cidade', localidade)
    setValue('estado', uf)
    toast.success('Endereço preenchido automaticamente!')
  }

  function handleCPFChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 11)
    setValue('cpf', formatarCPF(v))
  }

  function handleTelChange(field: 'telefone' | 'whatsapp', e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 11)
    setValue(field, formatarTelefone(v))
  }

  function handleCEPChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/\D/g, '').slice(0, 8)
    setValue('cep', formatarCEP(v))
  }

  async function onSubmit(data: FormData) {
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      const { data: novoUsuario, error } = await supabase
        .from('usuarios')
        .insert({
          nome: data.nome,
          cpf: data.cpf.replace(/\D/g, ''),
          rg: data.rg || null,
          data_nascimento: data.data_nascimento || null,
          titulo_eleitoral: data.titulo_eleitoral || null,
          telefone: data.telefone || null,
          whatsapp: data.whatsapp || null,
          cep: data.cep?.replace(/\D/g, '') || null,
          endereco: data.endereco || null,
          numero: data.numero || null,
          complemento: data.complemento || null,
          bairro: data.bairro || null,
          cidade: data.cidade || null,
          estado: data.estado || null,
          cadastrado_por: user?.id || null,
          nome_assessor: nomeAssessor || null,
        })
        .select()
        .single()

      if (error) {
        error.code === '23505'
          ? toast.error('CPF já cadastrado no sistema!')
          : toast.error(`Erro ao salvar: ${error.message}`)
        setSalvando(false)
        return
      }

      toast.success(`${data.nome} cadastrado(a) com sucesso!`)

      if (data.enviar_wa && (data.whatsapp || data.telefone)) {
        const numero = data.whatsapp || data.telefone
        const { data: config } = await supabase.from('configuracoes').select('valor').eq('chave', 'msg_boas_vindas').single()
        const template = config?.valor || 'Olá {nome}! 🎉 Bem-vindo(a) à IECE Guarulhos!'

        const res = await fetchAutenticado('/api/notificacoes/whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_id: novoUsuario.id,
            telefone: numero,
            tipo: 'cadastro',
            mensagem_template: template,
            variaveis: { nome: data.nome.split(' ')[0] },
          }),
        })
        const resultado = await res.json()
        if (resultado.sucesso) toast.success('WhatsApp de boas-vindas enviado! 📱')
      }

      reset()
    } catch {
      toast.error('Erro inesperado. Tente novamente.')
    }
    setSalvando(false)
  }

  return (
    <div className="max-w-3xl">
      {/* Info do assessor logado */}
      {nomeAssessor && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-5 flex items-center gap-3">
          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
            {nomeAssessor.charAt(0)}
          </div>
          <div>
            <p className="text-sm font-medium text-orange-800">Cadastrando como: <strong>{nomeAssessor}</strong></p>
            <p className="text-xs text-orange-600">{userEmail} · {new Date().toLocaleString('pt-BR')}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Dados pessoais */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Dados pessoais</h2>
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-1">Nome completo *</label>
            <input {...register('nome', { required: 'Nome é obrigatório' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="Nome completo" />
            {errors.nome && <p className="text-red-500 text-xs mt-1">{errors.nome.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">CPF *</label>
              <input {...register('cpf', { required: 'CPF é obrigatório' })} onChange={handleCPFChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="000.000.000-00" maxLength={14} />
              {errors.cpf && <p className="text-red-500 text-xs mt-1">{errors.cpf.message}</p>}
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">RG</label>
              <input {...register('rg')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="00.000.000-0" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Data de nascimento</label>
              <input type="date" {...register('data_nascimento')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Título eleitoral</label>
              <input {...register('titulo_eleitoral')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Nr título eleitoral" />
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Endereço</h2>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4 text-xs text-orange-700">
            📍 Digite o CEP e clique em <strong>Buscar</strong> para preencher automaticamente
          </div>
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">CEP</label>
              <input {...register('cep')} onChange={handleCEPChange}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="00000-000" maxLength={9} />
            </div>
            <div className="flex items-end">
              <button type="button" onClick={handleBuscarCEP} disabled={buscandoCEP}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                {buscandoCEP ? 'Buscando...' : '🔍 Buscar'}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Endereço</label>
              <input {...register('endereco')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Rua/Avenida..." />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Número</label>
              <input {...register('numero')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Nr" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Complemento</label>
              <input {...register('complemento')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Apto/Casa" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Bairro</label>
              <input {...register('bairro')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Bairro" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Cidade</label>
              <input {...register('cidade')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="Cidade" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Estado</label>
              <input {...register('estado')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="SP" maxLength={2} />
            </div>
          </div>
        </div>

        {/* Contato */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Contato</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Telefone</label>
              <input {...register('telefone')} onChange={e => handleTelChange('telefone', e)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="(11) 0000-0000" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">WhatsApp</label>
              <input {...register('whatsapp')} onChange={e => handleTelChange('whatsapp', e)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="(11) 99999-9999" />
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <input type="checkbox" id="enviar_wa" {...register('enviar_wa')} className="w-4 h-4 accent-green-600" />
            <label htmlFor="enviar_wa" className="text-sm text-green-800 cursor-pointer">
              📱 Enviar mensagem de boas-vindas via WhatsApp ao cadastrar
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={salvando}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60">
            {salvando ? '⏳ Salvando...' : '💾 Salvar cadastro'}
          </button>
          <button type="button" onClick={() => reset()}
            className="border border-gray-300 text-gray-600 px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50">
            Limpar
          </button>
        </div>
      </form>
    </div>
  )
}
