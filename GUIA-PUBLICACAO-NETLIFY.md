# Publicação do Vida Produtiva no Netlify

## Importante

Não use o recurso de arrastar e soltar uma pasta pronta no Netlify. Esse método publica somente arquivos estáticos e não criará o banco, o login nem as rotas da OpenAI.

O projeto deve ser enviado para um repositório GitHub e conectado ao Netlify.

Esta é a versão limpa para publicação. Ela não contém `node_modules`, `.next`, `out` ou outros milhares de arquivos gerados.

## Passo a passo

1. Descompacte `vida-produtiva-github-raiz.zip`.
2. Crie um repositório privado e vazio no GitHub.
3. Dentro do repositório, clique em **Add file** e depois **Upload files**.
4. Abra a pasta descompactada `vida-produtiva-github-raiz`, selecione todos os itens que estão dentro dela e arraste para a tela do GitHub. As pastas `app`, `lib`, `netlify`, `public` e `tests` devem aparecer diretamente na raiz do repositório. Esta versão possui menos de 40 arquivos.
5. Clique em **Commit changes**.

Antes de continuar, abra a página inicial do repositório e confirme que estes arquivos aparecem diretamente na primeira tela, fora de qualquer pasta:

```text
package.json
next.config.mjs
tsconfig.json
next-env.d.ts
netlify-database.d.ts
```

Se `package.json` não estiver visível na primeira tela do GitHub, não faça o deploy: volte e envie os arquivos soltos da raiz.
6. No Netlify, escolha **Add new project** e depois **Import an existing project**.
7. Selecione o repositório criado.
8. Configure os campos do build:

```text
Base directory: deixe vazio
Build command: npm run build
Publish directory: .next
Functions directory: deixe vazio
```
9. Antes de publicar, cadastre em **Environment variables**:

```text
VP_ADMIN_EMAIL=seu-email
VP_ADMIN_PASSWORD=uma-senha-longa-e-exclusiva
OPENAI_API_KEY=sua-chave-da-openai
OPENAI_REPORT_MODEL=gpt-5-mini
```

A chave da OpenAI é opcional. As variáveis `VP_ADMIN_EMAIL` e `VP_ADMIN_PASSWORD` são obrigatórias para o primeiro login.
Não cadastre `VP_LOCAL_MODE` no Netlify. Essa variável serve somente para executar uma cópia local sem banco online.

10. Inicie o deploy.
11. O Netlify criará automaticamente o PostgreSQL e aplicará a migração da pasta `netlify/database/migrations`.
12. Abra o endereço publicado e faça o primeiro login com o e-mail e a senha cadastrados.
13. Entre em **Administração**, crie os acessos dos voluntários e use o botão para testar a conexão com a OpenAI.

O administrador definido em `VP_ADMIN_EMAIL` é o único usuário que pode criar acessos, importar backups completos e excluir negócios. Os voluntários visualizam, criam e editam todos os atendimentos compartilhados.

Se o administrador esquecer a senha, altere `VP_ADMIN_PASSWORD` no Netlify, faça um novo deploy e entre usando a nova senha. O sistema atualizará com segurança a senha administrativa gravada no banco.

## Como os dados ficam protegidos

- O banco online é a fonte principal.
- O navegador mantém uma cópia local adicional.
- Cada sincronização cria uma versão histórica.
- As 500 versões mais recentes são mantidas.
- Edições concorrentes são detectadas antes de sobrescrever dados.
- O sistema bloqueia alterações se o banco online estiver indisponível.
- O backup manual em JSON continua disponível.

## Primeiro deploy

O banco real somente existe depois que o Netlify concluir o primeiro deploy. Após publicar, faça um cadastro de teste, feche o navegador, abra em outro computador e confirme que o atendimento aparece após o login.
