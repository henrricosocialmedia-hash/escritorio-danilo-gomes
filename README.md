# IECE Sistema de Gestão

Sistema completo para gestão de usuários, atendimentos e notificações da IECE Guarulhos.

## Funcionalidades

- ✅ Dashboard com aniversariantes do dia e amanhã
- ✅ Cadastro de usuários com **preenchimento automático de endereço por CEP** (ViaCEP)
- ✅ **Envio automático de WhatsApp** ao realizar novo cadastro (Z-API)
- ✅ **Envio automático de WhatsApp de aniversário** (Cron diário)
- ✅ Gestão de atendimentos (tipos e origens)
- ✅ Cadastro e consulta de atendentes
- ✅ Consulta de usuários por nome ou CPF
- ✅ Log de todas as notificações enviadas
- ✅ Fotos de eventos
- ✅ Autenticação segura via Supabase

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend + Backend | Next.js 14 (App Router) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Hospedagem | Vercel (gratuito) |
| CEP automático | ViaCEP (gratuito) |
| WhatsApp | Z-API |

---

## Configuração passo a passo

### 1. Supabase

1. Acesse https://app.supabase.com e crie um novo projeto
2. Vá em **SQL Editor** e execute o conteúdo de `supabase/migrations/001_schema.sql`
3. Anote a **Project URL** e **anon key** em Settings > API

### 2. Z-API

1. Acesse https://app.z-api.io e crie uma conta
2. Crie uma nova instância
3. Escaneie o QR Code com o WhatsApp Business que enviará as mensagens
4. Anote o **Instance ID**, **Token** e **Client Token**

### 3. Variáveis de ambiente

Copie `.env.local.example` para `.env.local` e preencha:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
ZAPI_INSTANCE_ID=seu_instance_id
ZAPI_TOKEN=seu_token
ZAPI_CLIENT_TOKEN=seu_client_token
CRON_SECRET=uma_senha_secreta_qualquer
```

> `SUPABASE_SERVICE_ROLE_KEY` (Settings > API > service_role) é obrigatória: as rotas do servidor usam essa chave para criar acessos aprovados, gravar o log do WhatsApp e rodar o cron. Nunca coloque essa chave em variáveis `NEXT_PUBLIC_`.
>
> `CRON_SECRET` também é obrigatória: sem ela o cron de aniversários fica bloqueado.

### 4. Instalar e rodar

```bash
npm install
npm run dev
```

Acesse http://localhost:3000

### 5. Deploy na Vercel

```bash
npm install -g vercel
vercel
```

Configure as mesmas variáveis de ambiente no painel da Vercel (Settings > Environment Variables).

---

## Cron de aniversários (envio automático diário)

Para enviar WhatsApp automaticamente para aniversariantes todo dia às 8h:

### Opção 1: Vercel Cron (recomendado)

Já configurado em `vercel.json` (o horário do cron é em UTC: `0 11 * * *` = 8h de Brasília). A Vercel envia o `CRON_SECRET` automaticamente:

```json
{
  "crons": [{
    "path": "/api/cron/aniversarios",
    "schedule": "0 11 * * *"
  }]
}
```

### Opção 2: cron-job.org (gratuito)

1. Acesse https://cron-job.org
2. Crie um job para: `GET https://seu-site.vercel.app/api/cron/aniversarios`
3. Horário: todos os dias às 08:00
4. Header: `Authorization: Bearer SUA_CRON_SECRET`

---

## Personalizar mensagens

As mensagens de WhatsApp são configuráveis pelo banco de dados.  
Acesse o Supabase > Table Editor > `configuracoes` e edite os campos:

| Chave | Descrição |
|---|---|
| `msg_boas_vindas` | Mensagem enviada ao cadastrar um novo usuário. Use `{nome}` para o primeiro nome. |
| `msg_aniversario` | Mensagem enviada no aniversário. Use `{nome}` para o primeiro nome. |
| `enviar_wa_cadastro` | `true` ou `false` para ativar/desativar envio no cadastro |
| `enviar_wa_aniversario` | `true` ou `false` para ativar/desativar envio no aniversário |

---

## Estrutura do projeto

```
src/
├── app/
│   ├── (admin)/
│   │   ├── layout.tsx          # Sidebar + topbar
│   │   ├── dashboard/          # Página inicial com aniversariantes
│   │   ├── atendimento/        # Novo atendimento
│   │   ├── cadastrar/
│   │   │   ├── usuario/        # Cadastro com CEP automático + WhatsApp
│   │   │   ├── tipo-atendimento/
│   │   │   └── atendente/
│   │   ├── consultar/
│   │   │   ├── usuario/        # Busca por nome ou CPF
│   │   │   └── atendimentos/
│   │   ├── notificacoes/       # Status Z-API e log de envios
│   │   └── eventos/            # Fotos de eventos
│   └── api/
│       ├── notificacoes/
│       │   ├── whatsapp/       # POST: envia mensagem
│       │   └── status/         # GET: status Z-API
│       └── cron/
│           └── aniversarios/   # GET: envia parabéns do dia
├── lib/
│   ├── supabase.ts             # Cliente Supabase
│   ├── zapi.ts                 # Integração Z-API
│   └── viacep.ts               # Busca CEP + formatações
└── supabase/
    └── migrations/
        └── 001_schema.sql      # Schema completo do banco
```
