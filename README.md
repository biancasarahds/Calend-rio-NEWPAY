# Calendário NewPayBank — versão compartilhada

Este projeto é um aplicativo web React + Vite conectado ao Supabase. O calendário é compartilhado entre os usuários autenticados e recebe atualizações em tempo real.

## Permissões configuradas

- `bs@newpay.com`: administrador
- `braz@newpay.com`: administrador
- Demais usuários criados no Supabase: visualizador (somente leitura)

Os dois administradores podem cadastrar, editar e excluir compromissos. Os demais usuários conseguem consultar a agenda.

## 1. Criar o banco online

1. Crie um projeto no [Supabase](https://supabase.com/).
2. Abra **SQL Editor** no painel do projeto.
3. Copie e execute todo o conteúdo de `supabase/schema.sql`.
4. Em **Project Settings > API**, copie a Project URL e a chave `anon`/publishable. Nunca use a chave `service_role` no navegador.

## 2. Criar os usuários

1. No Supabase, abra **Authentication > Users**.
2. Crie os usuários `bs@newpay.com` e `braz@newpay.com`, definindo uma senha segura para cada um.
3. Crie os usuários dos demais colaboradores que terão acesso. Eles serão visualizadores por padrão.
4. Volte ao SQL Editor e execute novamente somente este comando para garantir os dois administradores:

```sql
update public.profiles
set role = 'admin'
where lower(email) in ('bs@newpay.com', 'braz@newpay.com');
```

O sistema não contém senhas predefinidas. Cada pessoa deve usar sua própria senha.

## 3. Rodar localmente

É necessário ter Node.js 20 ou superior.

```bash
npm install
cp .env.example .env
```

Edite `.env` e informe os dados públicos do projeto Supabase:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Depois:

```bash
npm run dev
```

Para validar a versão de produção:

```bash
npm run build
npm run preview
```

## 4. Publicar para a equipe

Publique o repositório em um serviço como Vercel ou Netlify, usando estas variáveis de ambiente:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

O endereço público do site não libera o calendário: o login continua obrigatório. A segurança dos dados é aplicada pelas políticas RLS no Supabase.

## 5. Adicionar colaboradores

Crie o usuário em **Authentication > Users**. O trigger cria o perfil com papel `viewer`. Não promova colaboradores a `admin`, a menos que tenham autorização expressa.

## O que já está implementado

- Login por e-mail e senha.
- Calendário mensal com navegação e seleção de dia.
- Busca de compromissos.
- Cadastro, edição e exclusão para administradores.
- Categorias, descrição, horário, local e opção de dia inteiro.
- Agenda do dia e próximos compromissos.
- Atualização em tempo real entre sessões.
- Interface responsiva para computador e celular.
- Controle de acesso no banco de dados (RLS).

## O que precisa ser configurado antes do uso real

- Criar o projeto Supabase e executar o SQL.
- Criar os usuários e senhas.
- Inserir as variáveis de ambiente e publicar o site.
- Definir cidade/UF da empresa para incluir feriados estaduais e municipais. Esta primeira versão ainda não cadastra automaticamente feriados nacionais/regionais, aniversários ou recorrências.

## Observações de segurança

- Nunca compartilhe senhas por chat.
- Nunca coloque a chave `service_role` no frontend.
- Use senhas exclusivas e ative MFA no Supabase se a política da empresa exigir.
- O acesso de visualização também exige login.
