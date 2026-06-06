# Historico de queixas e correcoes

Registro das dificuldades relatadas durante a configuracao local, login administrativo,
sincronizacao com GitHub e persistencia das alteracoes do site.

## 2026-04-30

### Execucao do npm bloqueada no PowerShell

Queixa:
- Ao executar `npm install` e `npm run dev`, o PowerShell bloqueava `npm.ps1` com erro de politica de execucao de scripts.

Diagnostico:
- O Node estava instalado, mas o PowerShell tentava executar o wrapper `npm.ps1`.
- A politica local do Windows impedia scripts PowerShell.

Orientacao/correcao:
- Usar `npm.cmd install` e `npm.cmd run dev` no Windows quando o PowerShell bloquear `npm`.
- O backend local deve ser acessado por `http://localhost:3000/`.

### Login administrativo e senha com espaco

Queixa:
- Nao era possivel acessar usando `ipab2026 `.
- Depois, o login passou a funcionar em alguns caminhos, mas continuava falhando em outros.

Diagnostico:
- A senha digitada podia chegar com espacos extras.
- A URL `admin-logi` nao existia e retornava `404`.

Correcoes:
- `admin-login.html` passou a enviar a senha com `trim()`.
- `backend/server.js` passou a comparar a senha tambem com `trim()`.
- Foram criados atalhos/redirects:
  - `/admin-login` -> `/admin-login.html`
  - `/admin-logi` -> `/admin-login.html`
  - `/admin` -> `/admin.html`

Commits relacionados:
- `426e6f9 correcao login`
- `b12a42a fix: add admin login redirects`

### Alteracoes no painel nao apareciam no site

Queixa:
- Em `admin.html` o login funcionava, mas alteracoes nos campos nao mudavam o `index.html`.
- Uma alteracao feita no Hero, por exemplo em "Domingos", nao era salva.

Diagnostico:
- O arquivo `backend/data/content.json` nao era criado depois das edicoes.
- A API publica retornava `{"content":null}`, entao o `index.html` nao tinha dados novos para aplicar.
- Havia risco de abrir `admin.html` ou `index.html` diretamente como arquivo, ou por outra porta local, fora do backend.
- Quando isso acontece, o painel aparece visualmente, mas nao consegue conversar corretamente com `/api/content`.

Correcoes:
- `admin.html`, `admin-login.html` e `index.html` agora redirecionam automaticamente para `http://localhost:3000` quando abertos como arquivo local ou por outra porta local.
- O painel passou a usar `credentials: 'same-origin'` nas chamadas de login, sessao e salvamento.
- O backend passou a servir `admin.html`, `admin-login.html` e `index.html` com `Cache-Control: no-store`, evitando uso de HTML antigo em cache.
- O botao de salvar passou a mostrar estados mais claros:
  - `Salvando...`
  - `Salvo com sucesso`
  - erro quando a sessao expira ou quando o backend nao esta disponivel.

Commits relacionados:
- `c4e402a fix: autosave admin panel edits`
- `0aaab59 fix: force local pages through backend`
- `a6d061d fix: make admin saves explicit and uncached`

### Persistencia local do conteudo

Queixa:
- Foi perguntado se ainda nao era possivel salvar alteracoes pelo backend.

Diagnostico:
- O site inicialmente era estatico e nao tinha uma fonte persistente para as edicoes do painel.

Correcoes:
- Criado backend Express em `backend/server.js`.
- Criadas rotas:
  - `POST /api/login`
  - `POST /api/logout`
  - `GET /api/me`
  - `GET /api/content`
  - `PUT /api/content`
  - `GET /api/public-content`
- As alteracoes do painel passam a ser gravadas localmente em `backend/data/content.json`.
- O `index.html` carrega `/api/public-content` e aplica os dados salvos.

Commit relacionado:
- `d1bcc66 feat: add local backend content persistence`

### Commit, verificacao GitHub e sincronizacao

Queixas:
- Nao era possivel commitar pelo VS Code.
- O codigo de verificacao do GitHub nao chegava.
- O repositorio nao sincronizava.
- O colaborador `christian-klike` foi adicionado ao repositorio `Christian-ipab/ipaltobranco`.

Diagnostico:
- Havia pendencias de autenticacao/colaboracao no GitHub.
- O push tambem foi recusado uma vez porque o branch local estava atras do remoto.

Correcoes/orientacoes:
- Configuracao de identidade Git para commits locais.
- Uso de commit e push via terminal.
- Quando o GitHub recusou o push por `non-fast-forward`, foi executado `git pull --rebase` antes de reenviar.
- Apos o rebase, o push foi concluido com sucesso.

### Backend so funcionava local e nao persistia entre restarts

Queixa:
- O backend Express so funcionava em `http://localhost:3000`. No dominio publico (`ipaltobranco.com.br`, hospedado em GitHub Pages), nada do `/api/*` respondia.
- O objetivo declarado era que qualquer pessoa com credenciais pudesse editar pela web.
- Localmente, a sessao se perdia a cada restart do `npm run dev` porque o `express-session` usava `MemoryStore`.

Diagnostico:
- GitHub Pages so serve arquivos estaticos. Node.js nunca executou la.
- Os tres HTMLs tinham um redirect para `localhost:3000` que era util localmente mas inutil/confuso em producao.
- Persistencia em arquivo JSON (`backend/data/content.json`) nao funciona em hosts serverless e perde dados em reinicios em outros lugares.

Correcoes:
- Persistencia movida para um modulo dedicado (`backend/db.js`), com gravacao atomica em `content.json` e auditoria simples em `content-history.jsonl`.
- Em producao no Fly.io, esses arquivos ficam no volume persistente montado em `/data`.
- Sessoes movidas para cookies assinados (`cookie-session`), evitando `MemoryStore` no servidor.
- Auth multi-usuario: variavel `ADMIN_USERS="usuario:bcrypt_hash,..."`. Modo legado de senha unica (`ADMIN_PASSWORD`) continua funcionando como fallback enquanto a migracao nao acontece.
- Login agora aceita usuario+senha. Em modo legado, o campo de usuario fica oculto.
- Rate limit em `/api/login` (8 tentativas / 15min / IP).
- Cookie `secure: true` em producao, `trust proxy` ligado para Fly.io.
- Os redirects `localhost:3000` nos HTMLs foram removidos. Acesso via `file://` mostra mensagem clara em vez de redirecionar.
- Scripts de deploy: `Dockerfile`, `fly.toml`, `.dockerignore`.

## Estado esperado de uso local (apos a migracao)

1. Configurar variaveis de ambiente:

```powershell
copy .env.example .env
```

   Ajustar `SESSION_SECRET` e (opcional) configurar `ADMIN_USERS`.

2. Instalar dependencias:

```powershell
npm.cmd install
```

3. Iniciar o backend:

```powershell
npm.cmd run dev
```

4. Abrir o painel:

```text
http://localhost:3000/admin-login.html
```

5. Login:
   - Em modo legado (sem `ADMIN_USERS`): apenas a senha (`ADMIN_PASSWORD`).
   - Em modo multi-usuario: usuario + senha bcrypt.

6. Para gerar um hash bcrypt para `ADMIN_USERS`:

```powershell
npm.cmd run hash -- minhaSenha123
```

   Depois adicione `usuario:hash_gerado` em `ADMIN_USERS` no `.env` (separe varios com virgula).

7. Conferir o site em `http://localhost:3000/`. O arquivo `backend/data/content.json` deve existir apos o primeiro save.

## Estado esperado em producao (Fly.io)

1. Conta Fly.io criada e `flyctl` instalado.
2. `fly launch` na raiz do projeto (detecta o Dockerfile).
3. `fly volumes create ipab_data --size 1 --region gru`.
4. `fly secrets set SESSION_SECRET=<aleatorio> ADMIN_USERS="usuario:hash,..."`.
5. `fly deploy` e teste em `https://<app>.fly.dev`.
6. `fly certs create ipaltobranco.com.br` e atualizar registros no Registro.br conforme instrucao do Fly.
7. Apagar o arquivo `CNAME` (era exclusivo do GitHub Pages) e desligar GitHub Pages no `Settings -> Pages`.

## Observacoes tecnicas

- O diretorio `backend/data/` (conteudo salvo + historico) fica fora do Git.
- Em producao, o Fly monta o volume em `/data`. Local: usa `backend/data/`.
- Se `/api/public-content` retornar `{"content":null}`, nenhuma alteracao foi salva ainda.
- Auditoria: `GET /api/history` (admin) retorna as 20 ultimas edicoes (quem salvou e quando).
- Para revogar acesso de um editor: remover a entrada dele de `ADMIN_USERS` e fazer `fly deploy` (ou reiniciar o backend local).

## Proxima etapa com VPS + n8n

- O formulario de contato agora deve enviar para `/api/contact`, nao diretamente para um webhook publico.
- O backend repassa a mensagem ao n8n usando a variavel `N8N_CONTACT_WEBHOOK_URL`.
- Payload enviado ao n8n:
  - `nome`, `email`, `telefone`, `mensagem`
  - `origem=site-ipab`
  - `pagina`, `enviado_em`, `ip`, `user_agent`
- A rota tem limite de 10 envios por hora por IP e valida os campos obrigatorios.
- Na VPS/n8n, crie um workflow com Webhook `POST` e copie a URL de producao para `N8N_CONTACT_WEBHOOK_URL`.
