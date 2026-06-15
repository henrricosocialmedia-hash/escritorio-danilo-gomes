'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

interface Curso {
  id: string
  nome: string
  professor: string
  local: string
  dia_semana: string
  horario_inicio: string
  horario_fim: string
  data_inicio: string
  data_fim: string
}

interface Aluno {
  id: string
  nome: string
  cpf: string
  rg: string
  data_nascimento: string
  foto_url: string | null
}

export default function ImprimirCarteirinhaPage() {
  const searchParams = useSearchParams()
  const cursoId = searchParams.get('curso_id')
  const alunosIds = searchParams.get('alunos')?.split(',') || []

  const [curso, setCurso] = useState<Curso | null>(null)
  const [alunos, setAlunos] = useState<Aluno[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (cursoId && alunosIds.length > 0) carregarDados()
  }, [cursoId])

  async function carregarDados() {
    const [{ data: cursoData }, { data: alunosData }] = await Promise.all([
      supabase.from('cursos').select('*').eq('id', cursoId).single(),
      supabase.from('usuarios').select('id, nome, cpf, rg, data_nascimento, foto_url').in('id', alunosIds)
    ])
    setCurso(cursoData)
    setAlunos(alunosData || [])
    setLoading(false)
    setTimeout(() => window.print(), 800)
  }

  function formatarCPF(cpf: string) {
    if (!cpf) return '-'
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }

  function formatarData(data: string) {
    if (!data) return '-'
    return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')
  }

  function formatarValidade() {
    if (!curso) return ''
    if (curso.data_fim) return formatarData(curso.data_fim)
    const ano = new Date().getFullYear()
    return `31/12/${ano}`
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-400">Preparando carteirinhas...</p>
    </div>
  )

  return (
    <>
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .carteirinha-grid { page-break-inside: avoid; }
        }
        body { background: #f5f5f5; font-family: Arial, sans-serif; }
        .carteirinha-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          max-width: 800px;
          margin: 20px auto;
          padding: 16px;
        }
        .card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          width: 100%;
          break-inside: avoid;
        }
        .card-header {
          background: linear-gradient(135deg, #ea580c, #f97316);
          padding: 10px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .card-header-logo {
          width: 32px;
          height: 32px;
          background: rgba(255,255,255,0.25);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 14px;
          color: white;
          flex-shrink: 0;
        }
        .card-header-text { flex: 1; min-width: 0; }
        .card-header-titulo {
          color: rgba(255,255,255,0.8);
          font-size: 8px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .card-header-curso {
          color: white;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-body {
          padding: 12px 14px;
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .foto-wrapper {
          flex-shrink: 0;
          width: 64px;
          height: 80px;
          border-radius: 8px;
          overflow: hidden;
          border: 2px solid #f0f0f0;
          background: #f9f9f9;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .foto-wrapper img { width: 100%; height: 100%; object-fit: cover; }
        .foto-placeholder {
          font-size: 28px;
          color: #d1d5db;
          text-align: center;
        }
        .info { flex: 1; min-width: 0; }
        .nome {
          font-size: 13px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 6px;
          line-height: 1.2;
        }
        .dado {
          font-size: 9.5px;
          color: #6b7280;
          margin-bottom: 3px;
          display: flex;
          gap: 4px;
        }
        .dado-label { font-weight: 600; color: #374151; min-width: 26px; }
        .card-footer {
          border-top: 1px solid #f3f4f6;
          padding: 7px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #fafafa;
        }
        .validade-label { font-size: 8px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
        .validade-data { font-size: 10px; font-weight: 700; color: #ea580c; }
        .assinatura {
          text-align: center;
        }
        .assinatura-linha {
          width: 80px;
          height: 1px;
          background: #d1d5db;
          margin: 0 auto 2px;
        }
        .assinatura-texto { font-size: 7.5px; color: #9ca3af; }
        .page-title {
          text-align: center;
          padding: 16px;
          font-size: 14px;
          color: #6b7280;
          font-weight: 600;
        }
        .btn-imprimir {
          display: block;
          margin: 0 auto 16px;
          background: #ea580c;
          color: white;
          border: none;
          padding: 10px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>

      <div className="no-print" style={{ textAlign: 'center', padding: '16px' }}>
        <button className="btn-imprimir" onClick={() => window.print()}>
          🖨️ Imprimir / Salvar PDF
        </button>
        <p style={{ fontSize: '12px', color: '#9ca3af' }}>
          {alunos.length} carteirinha(s) — {curso?.nome}
        </p>
      </div>

      <div className="carteirinha-grid">
        {alunos.map(aluno => (
          <div key={aluno.id} className="card">
            {/* Cabeçalho laranja */}
            <div className="card-header">
              <div className="card-header-logo">DG</div>
              <div className="card-header-text">
                <div className="card-header-titulo">Escritório Danilo Gomes</div>
                <div className="card-header-curso">{curso?.nome}</div>
              </div>
            </div>

            {/* Corpo */}
            <div className="card-body">
              <div className="foto-wrapper">
                {aluno.foto_url ? (
                  <img src={aluno.foto_url} alt={aluno.nome} />
                ) : (
                  <div className="foto-placeholder">👤</div>
                )}
              </div>
              <div className="info">
                <div className="nome">{aluno.nome}</div>
                <div className="dado">
                  <span className="dado-label">CPF</span>
                  <span>{formatarCPF(aluno.cpf)}</span>
                </div>
                {aluno.rg && (
                  <div className="dado">
                    <span className="dado-label">RG</span>
                    <span>{aluno.rg}</span>
                  </div>
                )}
                {aluno.data_nascimento && (
                  <div className="dado">
                    <span className="dado-label">Nasc.</span>
                    <span>{formatarData(aluno.data_nascimento)}</span>
                  </div>
                )}
                {curso?.professor && (
                  <div className="dado">
                    <span className="dado-label">Prof.</span>
                    <span>{curso.professor}</span>
                  </div>
                )}
                {curso?.dia_semana && (
                  <div className="dado">
                    <span className="dado-label">Dias</span>
                    <span>{curso.dia_semana} {curso.horario_inicio ? `· ${curso.horario_inicio.slice(0,5)}` : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé */}
            <div className="card-footer">
              <div>
                <div className="validade-label">Válido até</div>
                <div className="validade-data">{formatarValidade()}</div>
              </div>
              <div className="assinatura">
                <div className="assinatura-linha" />
                <div className="assinatura-texto">Assinatura</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
