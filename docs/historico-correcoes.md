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

## Estado esperado de uso local

Para editar e ver alteracoes:

1. Iniciar o backend:

```powershell
npm.cmd run dev
```

2. Abrir o painel:

```text
http://localhost:3000/admin-login.html
```

3. Entrar com a senha local.

4. Fazer a alteracao e clicar em `Salvar alteracoes`.

5. Conferir o site:

```text
http://localhost:3000/
```

6. O arquivo `backend/data/content.json` deve existir depois de uma alteracao salva.

## Observacoes tecnicas

- `backend/data/content.json` fica fora do Git por estar listado no `.gitignore`.
- Isso evita versionar conteudo local editado pelo painel.
- Se `/api/public-content` retornar `{"content":null}`, nenhuma alteracao foi salva ainda.
- Se o painel mostrar erro de backend, confirmar se o servidor esta rodando em `http://localhost:3000`.
