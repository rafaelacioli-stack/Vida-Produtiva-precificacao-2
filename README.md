# Vida Produtiva

Sistema de custeio e precificação do projeto social Vida Produtiva, criado para apoiar pequenos negócios durante atendimentos voluntários.

## Recursos

- Cadastro e consulta de vários negócios atendidos
- Insumos com embalagem, preço de compra e percentual de aproveitamento
- Produtos, fichas técnicas, porções e custo direto por unidade
- Despesas mensais com três opções de rateio
- Estimativa mensal de vendas por produto
- Pesquisa de até cinco concorrentes por produto, com nota de experiência
- Faixa de preço mínimo, sugerido e máximo
- Um único ponto de equilíbrio mensal do negócio, calculado pelo mix previsto de vendas
- Relatório escrito de até 2.000 caracteres gerado pela OpenAI, com alternativa automática local
- Relatório final imprimível e relatório escrito baixável em PDF
- Salvamento automático no navegador
- Exportação e importação de backup em JSON
- Login protegido no ambiente Netlify
- Banco PostgreSQL provisionado automaticamente pelo Netlify Database
- Histórico automático de versões a cada sincronização

## Como executar

Instale o Node.js LTS, abra o terminal nesta pasta e execute:

```powershell
npm install
npm run dev
```

Depois abra `http://localhost:3000`.

No Windows, depois de instalar o Node.js, também é possível abrir o sistema dando dois cliques em `INICIAR-SISTEMA.cmd`.
O iniciador verifica o Node.js, prepara o projeto na primeira execução e abre o sistema em modo de produção, sem o depurador de desenvolvimento.

## Configurar o relatório com OpenAI

Copie `.env.example` para `.env.local`, informe sua chave e reinicie o sistema:

```text
OPENAI_API_KEY=sua_chave_aqui
OPENAI_REPORT_MODEL=gpt-5-mini
```

A chave fica somente no servidor e não é incluída nos backups. Sem chave ou sem conexão, o botão ainda gera uma versão automática local do relatório.

## Publicar no Netlify com banco online

Publique todos os itens desta pasta diretamente na raiz de um repositório Git e conecte esse repositório ao Netlify. Não envie apenas arquivos estáticos, pois o banco, login e geração por IA precisam das rotas de servidor.

Configure o build no painel conforme o arquivo `GUIA-PUBLICACAO-NETLIFY.md`. O adaptador moderno do Next.js é aplicado automaticamente pelo Netlify. Durante o primeiro deploy, o Netlify instala `@netlify/database`, provisiona um PostgreSQL e aplica automaticamente a migração em `netlify/database/migrations`.

No painel do Netlify, cadastre estas variáveis de ambiente:

```text
VP_ADMIN_EMAIL=seu-email-de-administrador
VP_ADMIN_PASSWORD=uma-senha-longa-e-exclusiva
OPENAI_API_KEY=sua-chave-opcional-da-openai
OPENAI_REPORT_MODEL=gpt-5-mini
```

No primeiro login, o usuário administrador é criado com o e-mail e a senha configurados. Para recuperar o acesso administrativo, altere `VP_ADMIN_PASSWORD` no Netlify, faça um novo deploy e entre usando a nova senha.

Quando o sistema é aberto no Netlify:

- exige login;
- compartilha todos os negócios entre os usuários autorizados;
- permite somente ao administrador criar usuários, importar backups completos e excluir negócios;
- salva cada alteração no banco online após uma pequena pausa;
- mantém uma cópia local adicional no navegador;
- registra uma versão histórica a cada sincronização;
- mantém as 500 versões mais recentes para recuperação técnica;
- detecta edição concorrente para evitar sobrescrever silenciosamente alterações de outro computador;
- bloqueia alterações quando o banco está indisponível.

Na primeira entrada após a publicação, se o banco estiver vazio e houver dados antigos no navegador, eles são migrados automaticamente para o banco online.

## Como funciona a sugestão

- **Custo total unitário:** custo direto da ficha técnica + parcela unitária das despesas indiretas.
- **Preço sem prejuízo unitário:** custo total dividido pelo percentual restante após impostos, cartão, aplicativos e outras taxas sobre a venda.
- **Ponto de equilíbrio mensal do negócio:** despesas indiretas mensais divididas pela margem de contribuição percentual do mix previsto de vendas. O resultado mostra quantos reais o negócio precisa faturar para cobrir custos diretos, taxas e despesas indiretas.
- **Preço pela margem:** preço necessário para pagar custos, taxas e alcançar a margem líquida desejada.
- **Base dos multiplicadores:** pode ser o custo direto da ficha técnica, recomendado para alimentação, ou o custo total, opção mais conservadora.
- **Preço mínimo:** maior valor entre `2 × base escolhida`, preço sem prejuízo unitário e menor preço concorrente.
- **Preço máximo:** usa a média entre o concorrente mais caro e `3 × base escolhida`, sem ficar abaixo do mínimo ou do preço necessário para a margem desejada.
- **Sem concorrentes:** a sugestão parte do preço pela margem, respeitando a faixa de duas a três vezes o custo.
- **Com concorrentes:** combina o preço pela margem com a média de mercado ponderada pela nota de experiência, respeitando a faixa calculada.

As regras são apoio à decisão e não garantem aderência universal ao mercado. Negócios com delivery, tributação elevada, alto custo de mão de obra, posicionamento premium ou baixa escala exigem análise adicional.

## Segurança dos dados

No Netlify, o banco online é a fonte principal e o navegador mantém uma cópia local adicional. Use também o botão **Exportar backup** periodicamente e guarde o arquivo em local seguro. Para restaurar os dados, use **Importar backup**.

Antes do relatório, o sistema mostra uma verificação de prontidão. Pendências obrigatórias bloqueiam a geração do parecer; concorrentes e categorias continuam opcionais e aparecem apenas como pontos de atenção.

## Verificações

```powershell
npm test
npm run typecheck
npm run build
```
