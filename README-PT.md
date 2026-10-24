# ActivityDay — versão Supabase

## O que inclui
- Login, criação de conta, logout e recuperação/alteração de palavra-passe com Supabase Auth. O link de recuperação abre um formulário próprio antes de voltar ao login.
- Actividades em PostgreSQL, com políticas RLS para isolar os dados por utilizador.
- Sincronização entre dispositivos e actualizações em tempo real (Realtime deve estar activado para `public.activities` no Supabase).
- Categorias, frequência, estado, prioridade, data prevista, calendário mensal e lembretes do navegador.
- Exportação JSON e eliminação das próprias actividades.
- PWA básica (manifest + service worker).

## Instalação
1. No Supabase, abre SQL Editor, cola `supabase_setup.sql` e executa.
2. Em Project Settings → API Keys / Data API, copia o Project URL e a publishable key (ou anon public key antiga). **Nunca uses `service_role` ou `sb_secret_` no browser.**
3. Abre `https://activityday.netlify.app/`. A primeira vez, o ecrã “Ligar ao Supabase” pede o URL e a chave pública. Essa configuração fica guardada no navegador. Para configurar noutro dispositivo, repete este passo.
4. Em Supabase → Authentication → URL Configuration:
   - Site URL: `https://activityday.netlify.app`
   - Redirect URLs: `https://activityday.netlify.app/**`
5. Em Authentication → Providers, confirma que Email está activo. Para recuperação de palavra-passe, confirma que o URL de redireccionamento é permitido. O e-mail padrão do Supabase pode ter limites baixos; configura SMTP próprio para produção.
6. Para sincronização em tempo real, abre Database → Publications/Realtime e activa a tabela `public.activities` para Postgres Changes, caso ainda não esteja activa.
7. Envia os ficheiros desta pasta para o Netlify, substituindo os ficheiros da versão antiga. O `index.html` deve ficar na raiz publicada. Depois de publicar, solicita um novo e-mail de recuperação e testa o fluxo completo.

## Segurança
- A publishable/anon key é pública por desenho; a segurança depende das políticas RLS do SQL.
- Nunca coloques `service_role` ou `sb_secret_` no código público.
- Usa palavras-passe únicas e fortes. Para uma aplicação com dados sensíveis, considera MFA e revisão de segurança.
- O botão “Apagar todas as minhas actividades” apaga as tarefas, não a conta de autenticação.
- Não há função administrativa para apagar utilizadores no browser; isso exigiria fluxo server-side seguro.

## Limitações honestas
- Notificações do navegador só são verificadas enquanto a aplicação está aberta. Notificações push quando a app está fechada requerem um serviço push/servidor adicional.
- A sincronização precisa de ligação à Internet; não existe ainda fila offline para sincronizar alterações feitas sem rede.
- A configuração do projecto é guardada localmente no navegador, por isso deve ser configurada em cada dispositivo. As actividades e a conta sincronizam pela nuvem.
- O link de recuperação deve ser testado após configurar os Redirect URLs e o envio de e-mail.


## Publicar para todos os visitantes (importante)

A configuração do Supabase deve ficar no ficheiro `config.js`, e não apenas no `localStorage` de um navegador.

1. Abra `config.js` num editor de texto.
2. Na propriedade `key`, substitua `COLOCA_AQUI_A_TUA_CHAVE_SB_PUBLISHABLE_OU_ANON_PUBLIC` pela chave pública `sb_publishable_...` (ou a antiga `anon` pública) do projecto Supabase.
3. Confirme que o URL é `https://ijnheozmhnhnkvvwrcux.supabase.co`.
4. Não use `service_role` nem `sb_secret_` no frontend.
5. Faça deploy de todos os ficheiros, incluindo `config.js`, com `index.html` na raiz.
6. Depois do deploy, abra o site numa janela anónima. Com a chave configurada, deve aparecer o login, não o ecrã de configuração.

Se o navegador continuar a mostrar a versão antiga, faça uma actualização forçada (Ctrl+F5) ou limpe os dados do site.
