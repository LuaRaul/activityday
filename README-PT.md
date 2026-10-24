# ActivityDay — migração Vue 3

Aplicação migrada para Vue 3 + Vite, Vue Router, Pinia e Supabase JS.

## Funcionalidades implementadas nesta migração
- Login, criação de conta, recuperação de palavra-passe e definição de nova palavra-passe.
- Gestão de actividades: criar, concluir, apagar, pesquisar e filtrar.\n- Recorrência básica: ao concluir uma actividade diária, semanal ou mensal com data definida, cria a próxima ocorrência.
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
\n\n## Recorrência (Fase 2)\nActividades com frequência `Diária`, `Semanal` ou `Mensal` e `due_date` definida geram a próxima ocorrência quando são concluídas. A ocorrência concluída é mantida no histórico. Para evitar alterações ao esquema Supabase, a frequência `Única` não é considerada recorrente; nota: o esquema SQL actual só aceita `Diária`, `Semanal` e `Mensal`. A geração é feita no cliente, pelo que deve ser testada com conectividade e não oferece garantias idempotentes em casos de falha de rede/concorrência.\n

## Fase 3.1 — Hábitos

A página `/habits` permite criar hábitos diários ou semanais, registar o cumprimento do dia e arquivar hábitos sem apagar o histórico.

### Activar a funcionalidade no Supabase

1. Faz uma cópia de segurança normal dos teus dados antes de qualquer alteração.
2. Abre o Supabase Dashboard e entra em **SQL Editor**.
3. Abre `supabase_habits_migration.sql`, copia o conteúdo e executa-o no projecto correcto.
4. Não voltes a executar `supabase_setup.sql` por causa desta funcionalidade; a migração de hábitos é separada e não altera `activities`.
5. Inicia a aplicação e abre `/habits`.

A migração cria `public.habits` e `public.habit_logs`, activa RLS e restringe o acesso aos registos do utilizador autenticado. Os hábitos arquivados e os registos diários não são apagados pela interface.

### Testes recomendados

- Criar um hábito diário e registar/desmarcar a realização de hoje.
- Criar um hábito semanal com dias seleccionados e confirmar que a caixa fica desactivada nos restantes dias.
- Recarregar a página e confirmar que o registo persiste.
- Arquivar um hábito e confirmar que deixa de aparecer na lista activa.
- Confirmar que o login, actividades, calendário, lembretes e exportação continuam a funcionar.

Nota: os dias semanais usam a numeração JavaScript: domingo = 0, segunda = 1, ..., sábado = 6.


### Arquivar hábitos
Na página **Hábitos**, cada cartão de hábito activo apresenta agora o botão **Arquivar**. Ao clicar, a aplicação pede confirmação e marca o hábito como arquivado, mantendo os registos anteriores. O botão não elimina o histórico.
\n\n### Consultar e restaurar hábitos arquivados\nOs hábitos arquivados aparecem na secção **Hábitos arquivados** no final da página Hábitos. Usa **Restaurar** para voltar a colocar um hábito na lista activa. O registo do hábito e os seus logs são preservados; arquivar/restaurar actualiza apenas o campo `archived`.\n

### Indicadores diários após arquivar
Os indicadores preservam as realizações concluídas no dia mesmo que o hábito seja arquivado depois. O total de hábitos activos conta apenas hábitos activos; a consistência considera hábitos activos previstos para hoje e hábitos arquivados que já foram concluídos hoje. Arquivar um hábito que ainda não foi concluído não o conta como realização.


## Fase 3.2 — Metas
- Página `/goals`: criar metas, descrição, prazo, alvo numérico, progresso manual, concluir, reabrir, arquivar e restaurar.
- Antes de testar, executar `supabase_goals_migration.sql` no SQL Editor do Supabase correcto.
- O progresso de actividades não é automaticamente associado às metas nesta fase.


## Fase 3.3 — Relatórios

A vista **Relatórios** (`/reports`) apresenta indicadores de actividades, registos de hábitos e metas para os últimos 7, 30 ou 45 dias. Permite exportar um CSV compatível com Excel. Os dados são calculados no navegador a partir dos registos já carregados pela aplicação; não é necessária nova migração SQL. O histórico de hábitos carregado actualmente está limitado aos últimos 45 dias.


## Fase 3.4 — Pré-visualização e exportação PDF

Na página `/reports`, o botão **Pré-visualizar PDF** apresenta uma pré-visualização do relatório antes de exportar. A opção **Imprimir / Guardar PDF** abre uma página de impressão preparada para papel A4; na janela de impressão do navegador, selecciona **Guardar como PDF**. O documento inclui indicadores, período, actividades por categoria, progresso das metas e os registos incluídos no relatório. A exportação é feita no navegador e não requer nova dependência nem migração SQL.

A pré-visualização na aplicação apresenta até 12 linhas de detalhe para manter a interface rápida; o documento final inclui todos os registos do período.

## Fase 3.5 — Notificações Push com o site fechado

Esta fase adiciona a infraestrutura de push, mas só fica operacional depois de configurar as chaves e executar a migração no serviço correcto. As notificações dependem do suporte do navegador/dispositivo, de HTTPS e de permissões concedidas pelo utilizador.

### 1. Criar as tabelas no Supabase

1. Abre o painel do projecto Supabase correcto → **SQL Editor**.
2. Executa uma vez o ficheiro `supabase_push_migration.sql`.
3. Não voltes a executar o SQL de configuração inicial por causa desta funcionalidade. A migração nova não apaga nem altera actividades, hábitos ou metas existentes.

### 2. Gerar as chaves VAPID

No computador, na pasta do projecto, executa `npm install` e depois:

```bash
npx web-push generate-vapid-keys
```

Guarda as duas chaves geradas. A chave **pública** será usada pelo frontend; a chave **privada** é secreta e só pode existir nas variáveis do servidor Netlify. Não coloques a chave privada no `.env` com prefixo `VITE_`, no código frontend, no GitHub ou em capturas de ecrã.

### 3. Variáveis de ambiente no Netlify

Em **Site configuration → Environment variables**, configura:

- `SUPABASE_URL`: URL do projecto Supabase.
- `SUPABASE_ANON_KEY`: chave publishable/anon do projecto (usada para validar o token do utilizador).
- `SUPABASE_SERVICE_ROLE_KEY`: chave service_role/secret do servidor, estritamente privada. Nunca a uses no frontend.
- `VAPID_PUBLIC_KEY`: chave pública gerada.
- `VAPID_PRIVATE_KEY`: chave privada gerada.
- `VAPID_SUBJECT`: contacto válido, por exemplo `mailto:teu-email@exemplo.com`.
- `VITE_VAPID_PUBLIC_KEY`: a mesma chave pública VAPID, disponibilizada ao frontend durante o build.

Se estiveres a testar localmente, cria um `.env` local (não o publiques) com `VITE_VAPID_PUBLIC_KEY`, `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. As funções Netlify precisam também das variáveis de servidor no ambiente local suportado pelo Netlify CLI. Nunca uses uma service role no frontend.

### 4. Instalar dependências e publicar

1. Executa `npm install` para instalar `web-push` e actualizar o `package-lock.json`.
2. Executa `npm run build` e resolve qualquer erro antes de publicar.
3. Publica no Netlify. O ficheiro `netlify.toml` aponta para `netlify/functions`; `send-reminders.mjs` é agendada a cada minuto.
4. No painel Netlify, confirma que a função agendada `send-reminders` foi reconhecida e que não existem erros de execução.
5. Abre o site publicado em HTTPS, inicia sessão, abre **Lembretes** e clica em **Activar notificações push neste dispositivo**. Repete em cada dispositivo/navegador que queiras registar.

### 5. Comportamento e limitações

- A função agendada usa o fuso horário `Africa/Luanda` para comparar as datas e horas das actividades.
- As notificações são enviadas para subscrições registadas do utilizador e só para actividades não concluídas com data e hora definidas.
- O sistema regista os envios para evitar duplicados. Actividades atrasadas até um dia podem ser notificadas no próximo ciclo agendado; actividades antigas não são recuperadas.
- O navegador pode suspender ou bloquear push por configuração, economia de bateria ou políticas do dispositivo. Em iPhone/iPad, o suporte pode depender da versão do iOS e de a aplicação estar instalada no ecrã principal.
- Não há envio de SMS nem e-mail nesta fase. As notificações push precisam de internet no dispositivo no momento da entrega.
- As funções usam `SUPABASE_SERVICE_ROLE_KEY` no servidor, que contorna RLS. Protege essa chave e limita o acesso às variáveis Netlify.

### Teste de ponta a ponta

1. Cria uma actividade de teste com uma data de hoje e uma hora 2–3 minutos à frente.
2. Activa notificações push no dispositivo.
3. Fecha o separador/site (não basta navegar para outra rota) e aguarda a hora prevista.
4. Confirma que chega uma notificação e que clicar nela abre `/reminders`.
5. Verifica os logs da função agendada no Netlify se não chegar. Confirma também as variáveis, a migração SQL, as permissões do navegador e que a hora do dispositivo está correcta.
