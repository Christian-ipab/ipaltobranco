# Automação de boletins e transmissões

## Transmissões

O site usa a playlist automática de uploads do canal da IPAB:

`https://www.youtube.com/embed/videoseries?list=UURRL38Mk1LauwdbKkuDCjAA`

Todo vídeo publicado no canal passa a aparecer no player, sem edição do site ou do painel.

## Boletins

O workflow `.github/workflows/sync-boletins.yml` executa diariamente e também pode ser iniciado manualmente em **Actions > Sincronizar boletins > Run workflow**.

Ele:

1. percorre a pasta de boletins e todas as suas subpastas no Google Drive;
2. reconhece datas em nomes como `Boletim 07 DE JUNHO.pdf`;
3. copia os PDFs para `assets/boletins`;
4. atualiza `assets/boletins/boletins-auto.js`;
5. registra as alterações no GitHub;
6. publica a nova versão no Fly.io quando o token estiver configurado.

## Configuração única

1. No Google Cloud, habilite a **Google Drive API**.
2. Crie uma conta de serviço e gere uma chave JSON.
3. Compartilhe a pasta raiz `BOLETIM` com o endereço `client_email` dessa conta, como leitor.
4. Copie o ID da pasta a partir do endereço do Drive: `drive.google.com/drive/folders/ID_DA_PASTA`.
5. No GitHub, acesse **Settings > Secrets and variables > Actions** e crie:
   - `GOOGLE_DRIVE_FOLDER_ID`: ID da pasta raiz `BOLETIM`;
   - `GOOGLE_SERVICE_ACCOUNT_JSON`: conteúdo completo da chave JSON;
   - `FLY_API_TOKEN`: token de implantação do aplicativo `ipaltobranco`.
6. Execute o workflow manualmente uma vez e confira o resultado.

Nunca salve a chave JSON diretamente no repositório.
