# HoraLivre

Sistema web de agendamento e gestão operacional com arquitetura multiempresa, desenvolvido para empresas que precisam organizar serviços, clientes, agenda, relatórios e cobrança em um único fluxo.

## Status do projeto

Em desenvolvimento.

## Visão geral

O **HoraLivre** é uma aplicação web com foco em operação, agendamento e administração de empresas clientes. O sistema possui três frentes principais:

- **Admin master** para controle global da plataforma
- **Painel da empresa** para operação do negócio
- **Página pública de agendamento** para clientes finais

## Funcionalidades

### Painel administrativo
- Cadastro e gestão de empresas
- Controle de planos
- Gestão de cobrança
- Acompanhamento operacional
- Consulta de informações consolidadas
- Busca por empresa, slug, plano e contatos

### Painel da empresa
- Configuração dos dados do negócio
- Cadastro e edição de serviços
- Cadastro e edição de clientes
- Organização da agenda
- Acompanhamento de relatórios
- Checklist operacional

### Página pública
- Agendamento online
- Seleção de serviço e horário
- Resumo da solicitação
- Confirmação final do agendamento
- Integração com WhatsApp quando aplicável

## Estrutura do projeto

```text
HoraLivre/
├── assets/
│   ├── css/
│   └── js/
├── admin.html
├── agendar.html
├── bootstrap-tenant.html
├── bootstrap.html
├── cliente.html
├── firestore.indexes.json
├── firestore.rules
├── index.html
├── link-tenant-user.html
└── login.html

Tecnologias utilizadas
HTML
CSS
JavaScript
Firebase Authentication
Cloud Firestore
Firebase Hosting ou servidor estático compatível
Perfis de acesso
Admin master
Responsável pela operação central da plataforma.
Permissões principais:
gerenciar empresas
controlar planos
acompanhar suporte e cobrança
visualizar indicadores globais
Empresa cliente
Responsável pela operação do próprio negócio.
Permissões principais:
gerenciar serviços
gerenciar clientes
operar agenda
acompanhar relatórios
Usuário público
Acessa o link público da empresa para realizar agendamentos.
Páginas principais
index.html — página inicial
login.html — autenticação
admin.html — painel administrativo
cliente.html — painel da empresa
agendar.html — página pública de agendamento
bootstrap.html — apoio à configuração inicial
bootstrap-tenant.html — apoio à configuração inicial por empresa
link-tenant-user.html — vínculo entre usuário e tenant
Como executar localmente
Como o projeto utiliza módulos JavaScript no navegador, ele deve ser executado em um servidor local.
Opção 1: VS Code com Live Server
Abra o projeto no VS Code
Instale a extensão Live Server
Clique com o botão direito em index.html
Selecione Open with Live Server
Opção 2: Python
Na raiz do projeto, execute:

python -m http.server 5500

Depois abra:

http://localhost:5500

Configuração do Firebase
Este projeto depende de um projeto Firebase corretamente configurado.
Verifique:
credenciais do Firebase no arquivo de inicialização
Authentication habilitado
Cloud Firestore habilitado
regras publicadas a partir de firestore.rules
índices publicados a partir de firestore.indexes.json
Regras do Firestore

O projeto utiliza o arquivo:

firestore.rules

Sempre que esse arquivo for alterado, as regras devem ser publicadas novamente no Firebase para entrarem em vigor.

Publicar regras com Firebase CLI
Bash
firebase deploy --only firestore:rules
Índices do Firestore
O projeto também utiliza:
Plain text
firestore.indexes.json
Quando houver consultas com combinações de where, orderBy e limit, pode ser necessário atualizar os índices.
Publicar índices
Bash
firebase deploy --only firestore:indexes
Deploy completo
Se quiser publicar hospedagem e Firestore juntos:
Bash
firebase deploy
Observações importantes
O projeto utiliza type="module" nos scripts JavaScript
Não abra os arquivos HTML diretamente pelo explorador do sistema
Execute sempre via servidor local ou hospedagem
Se ocorrer erro como:
Plain text
does not provide an export named ...
verifique se o arquivo importado realmente exporta a função usada pelo módulo consumidor
Após atualizar arquivos JavaScript em produção, faça novo deploy e limpe o cache do navegador
Fluxo básico do sistema
Fluxo administrativo
Admin faz login
Admin acessa empresas cadastradas
Admin gerencia planos, status e cobrança
Admin acompanha indicadores operacionais
Fluxo da empresa
Empresa faz login
Configura seus dados
Cadastra serviços
Cadastra clientes
Opera a agenda
Consulta relatórios
Fluxo público
Cliente acessa o link público da empresa
Escolhe serviço e horário
Confirma os dados
Finaliza o agendamento
Boas práticas de manutenção
Ao alterar serviços JavaScript compartilhados:
preserve exports já utilizados por outros módulos
evite renomear funções sem atualizar imports
mantenha compatibilidade entre assets/js/modules/ e assets/js/services/
valide principalmente a área administrativa, pois ela centraliza várias integrações
Melhorias futuras sugeridas
adicionar capturas de tela
documentar collections do Firestore
documentar autenticação e perfis
mapear módulos JavaScript
separar ambiente de desenvolvimento e produção
criar pipeline de deploy
## Licença

Licença Proprietária.

Este projeto não pode ser utilizado, copiado, modificado ou distribuído sem autorização prévia, expressa e por escrito do autor.

Para publicar o README no GitHub, você pode fazer de dois jeitos.

**Pelo site do GitHub**
O GitHub permite adicionar ou editar arquivos direto pela interface web do repositório. Se o branch não estiver protegido, você pode criar ou editar o `README.md` e fazer um commit por ali. 1

Passo a passo:
1. Abra seu repositório `HoraLivre` no GitHub.
2. Na raiz do projeto, clique em **Add file**.
3. Clique em **Create new file** se ainda não existir `README.md`, ou clique no arquivo e depois no ícone de lápis para editar.
4. No nome do arquivo, use exatamente: `README.md`
5. Cole o conteúdo que te passei.
6. Embaixo, no campo de commit, escreva algo como:
   `docs: adiciona README do projeto`
7. Clique em **Commit changes**. 2

**Pelo Git local**
Se você já está trabalhando localmente no projeto, costuma ser melhor versionar assim:

```bash
git add README.md
git add firestore.rules
git commit -m "docs: adiciona README e atualiza regras do Firestore"
git push origin main

