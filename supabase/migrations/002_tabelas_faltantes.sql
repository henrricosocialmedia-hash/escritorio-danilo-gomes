-- IECE Sistema de Gestão - Tabelas e colunas que o sistema usa e não estavam no 001
-- Execute no Supabase SQL Editor DEPOIS do 001_schema.sql
-- Pode rodar de novo sem problema: só cria o que ainda não existe

-- Colunas extras em tabelas do 001
alter table usuarios add column if not exists foto_url text;
alter table usuarios add column if not exists observacao boolean default false;
alter table usuarios add column if not exists cadastrado_por uuid references auth.users(id) on delete set null;
alter table usuarios add column if not exists nome_assessor varchar(200);
-- O cadastro permite salvar sem data de nascimento
alter table usuarios alter column data_nascimento drop not null;

-- A aprovação de acesso faz upsert de atendentes pelo e-mail
create unique index if not exists atendentes_email_key on atendentes(email);

-- Dependentes (filhos/menores ligados a um usuário responsável)
create table if not exists dependentes (
  id uuid primary key default uuid_generate_v4(),
  responsavel_id uuid not null references usuarios(id),
  nome varchar(200) not null,
  data_nascimento date,
  escola varchar(200),
  periodo_escolar varchar(20),
  tem_deficiencia boolean default false,
  descricao_deficiencia text,
  quem_pode_retirar text,
  observacoes text,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Cursos
create table if not exists cursos (
  id uuid primary key default uuid_generate_v4(),
  nome varchar(200) not null,
  descricao text,
  professor varchar(200),
  local varchar(200),
  dia_semana varchar(100),
  horario_inicio time,
  horario_fim time,
  vagas_total integer default 0,
  vagas_disponiveis integer default 0,
  faixa_etaria_min integer default 0,
  faixa_etaria_max integer default 99,
  permite_adultos boolean default false,
  data_inicio date,
  data_fim date,
  ativo boolean default true,
  created_at timestamptz default now()
);

-- Inscrições em cursos (de um usuário ou de um dependente)
create table if not exists inscricoes (
  id uuid primary key default uuid_generate_v4(),
  curso_id uuid not null references cursos(id) on delete cascade,
  usuario_id uuid references usuarios(id),
  dependente_id uuid references dependentes(id),
  status varchar(20) not null default 'confirmado', -- 'confirmado', 'lista_espera', 'cancelado'
  posicao_espera integer,
  data_inscricao timestamptz default now(),
  inscrito_por uuid references auth.users(id) on delete set null,
  nome_assessor varchar(200),
  autorizado_sair_sozinho boolean default false,
  created_at timestamptz default now(),
  check (usuario_id is not null or dependente_id is not null)
);

-- Presença por aula
create table if not exists presencas (
  id uuid primary key default uuid_generate_v4(),
  curso_id uuid not null references cursos(id) on delete cascade,
  inscricao_id uuid not null references inscricoes(id) on delete cascade,
  data_aula date not null,
  presente boolean default false,
  registrado_por varchar(200),
  created_at timestamptz default now(),
  unique (inscricao_id, data_aula)
);

-- Pedidos de acesso feitos na tela de login
create table if not exists solicitacoes_acesso (
  id uuid primary key default uuid_generate_v4(),
  nome varchar(200) not null,
  email varchar(200) not null unique,
  telefone varchar(20),
  senha_temp text,
  status varchar(20) not null default 'pendente', -- 'pendente', 'aprovado', 'reprovado'
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Índices
create index if not exists idx_dependentes_responsavel on dependentes(responsavel_id);
create index if not exists idx_inscricoes_curso on inscricoes(curso_id);
create index if not exists idx_presencas_curso_data on presencas(curso_id, data_aula);

-- RLS: usuários logados acessam tudo
alter table dependentes enable row level security;
alter table cursos enable row level security;
alter table inscricoes enable row level security;
alter table presencas enable row level security;
alter table solicitacoes_acesso enable row level security;

drop policy if exists "Autenticados podem ver tudo" on dependentes;
drop policy if exists "Autenticados podem ver tudo" on cursos;
drop policy if exists "Autenticados podem ver tudo" on inscricoes;
drop policy if exists "Autenticados podem ver tudo" on presencas;
drop policy if exists "Autenticados podem ver tudo" on solicitacoes_acesso;
create policy "Autenticados podem ver tudo" on dependentes for all using (auth.role() = 'authenticated');
create policy "Autenticados podem ver tudo" on cursos for all using (auth.role() = 'authenticated');
create policy "Autenticados podem ver tudo" on inscricoes for all using (auth.role() = 'authenticated');
create policy "Autenticados podem ver tudo" on presencas for all using (auth.role() = 'authenticated');
create policy "Autenticados podem ver tudo" on solicitacoes_acesso for all using (auth.role() = 'authenticated');

-- Quem não está logado só pode ENVIAR um pedido de acesso, nunca ler os pedidos (que têm senha)
drop policy if exists "Visitantes podem pedir acesso" on solicitacoes_acesso;
create policy "Visitantes podem pedir acesso" on solicitacoes_acesso
  for insert to anon with check (status = 'pendente');

-- Storage: pastas públicas de fotos usadas pelo sistema
insert into storage.buckets (id, name, public) values
  ('eventos-fotos', 'eventos-fotos', true),
  ('carteirinhas', 'carteirinhas', true)
on conflict (id) do nothing;

drop policy if exists "Autenticados leem fotos" on storage.objects;
drop policy if exists "Autenticados enviam fotos" on storage.objects;
drop policy if exists "Autenticados atualizam fotos" on storage.objects;
drop policy if exists "Autenticados apagam fotos" on storage.objects;
create policy "Autenticados leem fotos" on storage.objects
  for select to authenticated using (bucket_id in ('eventos-fotos', 'carteirinhas'));
create policy "Autenticados enviam fotos" on storage.objects
  for insert to authenticated with check (bucket_id in ('eventos-fotos', 'carteirinhas'));
create policy "Autenticados atualizam fotos" on storage.objects
  for update to authenticated using (bucket_id in ('eventos-fotos', 'carteirinhas'));
create policy "Autenticados apagam fotos" on storage.objects
  for delete to authenticated using (bucket_id in ('eventos-fotos', 'carteirinhas'));
