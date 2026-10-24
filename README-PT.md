# ActivityDay — migração Vue 3

Aplicação migrada para Vue 3 + Vite, Vue Router, Pinia e Supabase JS.

## Funcionalidades implementadas nesta migração
- Login, criação de conta, recuperação de palavra-passe e definição de nova palavra-passe.
- Gestão de actividades: criar, concluir, apagar, pesquisar e filtrar.
- Categorias, frequência, prioridade, data e hora.
- Dashboard com contagem e progresso.
- Calendário mensal.
- Exportação de actividades para JSON.
- Lembretes do navegador enquanto a aplicação está aberta e permissão de notificações.
- Actualizações em tempo real via Supabase Realtime (activar para `public.activities` no painel Supabase).
- Selecção múltipla e eliminação em lote.
- Área de conta e privacidade, envio de link para alteração de palavra-passe e eliminação das actividades do utilizador.
- Supabase Auth e tabela `public.activities` com RLS.
- Netlify com fallback SPA para rotas.

## Publicação no Netlify
- Build command: `npm run build`
- Publish directory: `dist`
- Node: versão compatível com Vite 7 (Node 20.19+ ou 22.12+).
- `netlify.toml` já contém as definições e o fallback para SPA.

## Configuração Supabase
O URL e a chave publishable pública foram mantidos a partir do projecto fornecido em `src/supabase.js`. A publishable/anon key é pública por desenho. Nunca colocar `service_role` ou `sb_secret` no frontend.
Para configurar via variáveis do Netlify, define:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Se já existe a tabela `public.activities`, mantém a tabela e os utilizadores existentes. Não executes SQL destrutivo. Consulta `supabase_setup.sql` do projecto original apenas se precisares de criar a tabela.

## Antes de substituir o site actual
1. Testar localmente com `npm install` e `npm run dev`.
2. Executar `npm run build`.
3. Testar login, registo, reset password e CRUD com uma conta de teste.
4. Confirmar RLS em `public.activities` e Realtime, se necessário.
5. Publicar primeiro numa branch de preview ou num site de preview do Netlify.
6. Só depois promover para produção.

## Limitações desta primeira migração
Esta versão preserva as principais funções de autenticação, tarefas, categorias, calendário e exportação. As sugestões iniciais automáticas da versão original ainda não foram reconstruídas nesta migração. Os lembretes dependem de a aplicação estar aberta e da permissão de notificações do navegador. O Realtime depende de `public.activities` estar activada na publicação Realtime do Supabase. Testar todas as operações com uma conta de teste antes de publicar em produção.

## Navegação por rotas
A navegação está separada em URLs próprias:
- `/activities` — criar, pesquisar, filtrar, concluir e apagar actividades.
- `/calendar` — calendário mensal com actividades por data.
- `/reminders` — activar notificações do navegador e consultar próximas actividades.
- `/account` — privacidade, pedido de link para alterar palavra-passe, exportação e eliminação de actividades.
- `/export` — resumo e descarga das actividades em JSON.

O `netlify.toml` inclui fallback para `index.html`, necessário para abrir directamente estas rotas ou actualizar a página. Exportar JSON passou a ter uma página própria com um botão explícito para descarregar o ficheiro.
