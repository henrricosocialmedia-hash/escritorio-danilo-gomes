'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Toaster } from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  Home, Users, UserPlus, Tag, BadgeCheck,
  Search, List, Image, MessageSquare, LogOut, Menu, X,
  ShieldCheck, BookOpen, Baby, CreditCard
} from 'lucide-react'

const navItems = [
  { label: 'Página Inicial', href: '/dashboard', icon: Home },
  { section: 'Atendimento' },
  { label: 'Novo Atendimento', href: '/atendimento', icon: Users },
  { section: 'Cadastros' },
  { label: 'Usuário', href: '/cadastrar/usuario', icon: UserPlus },
  { label: 'Dependentes', href: '/cadastrar/dependentes', icon: Baby },
  { label: 'Tipo de Atendimento', href: '/cadastrar/tipo-atendimento', icon: Tag },
  { label: 'Atendentes', href: '/cadastrar/atendente', icon: BadgeCheck },
  { section: 'Consultas' },
  { label: 'Usuários', href: '/consultar/usuario', icon: Search },
  { label: 'Atendimentos', href: '/consultar/atendimentos', icon: List },
  { section: 'Cursos' },
  { label: 'Gerenciar Cursos', href: '/cursos', icon: BookOpen },
  { label: 'Carteirinhas', href: '/carteirinha', icon: CreditCard },
  { section: 'Administração' },
  { label: 'Aprovação de Acessos', href: '/aprovacao', icon: ShieldCheck },
  { section: 'Outros' },
  { label: 'Notificações WhatsApp', href: '/notificacoes', icon: MessageSquare },
  { label: 'Fotos de Eventos', href: '/eventos', icon: Image },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [iniciais, setIniciais] = useState('DG')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/auth/login')
        return
      }
      const email = data.user.email || ''
      const nome = data.user.user_metadata?.nome || email.split('@')[0] || 'Admin'
      setNomeUsuario(nome)
      const partes = nome.split(' ')
      if (partes.length >= 2) {
        setIniciais((partes[0][0] + partes[partes.length - 1][0]).toUpperCase())
      } else {
        setIniciais(nome.slice(0, 2).toUpperCase())
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const currentNav = navItems.find(n => 'href' in n && n.href === pathname)
  const pageTitle = 'label' in (currentNav || {}) ? (currentNav as { label: string }).label : 'Escritório Danilo Gomes'

  return (
    <div className="flex h-screen bg-gray-50">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} bg-white border-r border-gray-200 flex flex-col transition-all duration-200 flex-shrink-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-200">
          <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            DG
          </div>
          {sidebarOpen && (
            <div>
              <p className="font-semibold text-sm text-gray-800 leading-tight">Escritório Danilo Gomes</p>
              <p className="text-xs text-gray-400 leading-tight">Sistema de Gestão</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navItems.map((item, i) => {
            if ('section' in item) {
              return sidebarOpen ? (
                <p key={i} className="px-4 pt-4 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                  {item.section}
                </p>
              ) : <div key={i} className="my-1 mx-3 border-t border-gray-100" />
            }

            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon!

            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`flex items-center gap-3 px-4 py-2.5 mx-1 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-orange-50 text-orange-600 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon size={17} className="flex-shrink-0" />
                {sidebarOpen && item.label}
              </Link>
            )
          })}
        </nav>

        {/* Usuário logado + Sair */}
        <div className="border-t border-gray-200 p-3 space-y-1">
          {sidebarOpen && nomeUsuario && (
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {iniciais}
              </div>
              <p className="text-xs text-gray-600 truncate">{nomeUsuario}</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 w-full"
          >
            <LogOut size={16} />
            {sidebarOpen && 'Sair'}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-gray-600">
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <h1 className="text-base font-semibold text-gray-800">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white text-sm font-semibold">
              {iniciais}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
