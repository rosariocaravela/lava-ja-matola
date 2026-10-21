# 🚗 Lava Já Matola — Lavagem rápida e de confiança

> **Plataforma Digital para Lavagem Automóvel e Fidelização de Clientes**  
> **Localização do Estabelecimento:** Av. da Matola, Paragem Padaria, Matola, Moçambique (UTC+2)

---

## 1. Visão Geral

O **Lava Já Matola** é uma plataforma digital completa criada para modernizar e dinamizar o negócio de lavagem automóvel na Matola, respondendo a dois desafios centrais:

1. **Captação de Novos Clientes:** Acesso digital transparente aos serviços, horários e preços em Meticais (MT), localização integrada com rota no Google Maps e agendamento inteligente sem conflitos de capacidade.
2. **Fidelização Contínua:** O programa **«Passaporte Lava Já»** credita 10 pontos de boas-vindas, 10 pontos por lavagem básica, 20 por completa, 25 por lavagem de motor, 30 por lavagem premium e 40 por higienização especializada. Após a primeira lavagem concluída, credita mais 10 pontos a cada três semanas. As recompensas custam 50, 100, 150 ou 200 pontos.
3. **Cobrança após o serviço:** A marcação não exige pagamento antecipado. Após a conclusão, o cliente ou funcionário autorizado consulta a cobrança, acumula promoções e descontos elegíveis, aplica um voucher uma única vez e regista a simulação eletrónica ou o valor recebido no balcão.

A solução dispõe de um **Assistente de Inteligência Artificial conversacional**, gestão de vagas simultâneas de lavagem, notificações de conclusão, consulta da fila e do estado das viaturas, comprovativos de receção e de pagamento, e painéis dedicados para **Cliente**, **Funcionário** e **Administrador / Gestor**.

### Serviços disponíveis

O catálogo inicial apresenta serviços com nomes simples e descrições diretas. Os preços, durações e pontos podem ser ajustados pelo administrador:

| Serviço | Preço inicial | Duração | Pontos |
| :--- | ---: | ---: | ---: |
| Lavagem Exterior | 250 MT | 25 min | 10 |
| Lavagem Completa | 450 MT | 40 min | 20 |
| Lavagem do Motor | 600 MT | 45 min | 25 |
| Lavagem Completa Premium | 750 MT | 60 min | 30 |
| Limpeza de Estofos e Interior | 1.200 MT | 90 min | 40 |

### Fluxo de agendamento

O agendamento é apresentado em duas etapas. Na primeira, o cliente escolhe o serviço, a data e um horário disponível; o botão **«Avançar»** só fica ativo depois de selecionar serviço e horário. Cada horário de início aceita uma única reserva: depois de reservado, deixa de estar disponível para os outros clientes. Outros horários próximos continuam sujeitos à capacidade das vagas, que o servidor volta a validar no momento da confirmação. A página atualiza a disponibilidade a cada 15 segundos e quando volta a ficar ativa. A barra de progresso indica 50% nesta etapa e 100% na etapa seguinte. Na segunda, o cliente preenche os dados da viatura e contacto, pode aplicar um código promocional e confirma a reserva. É possível voltar para alterar o serviço ou horário.

O agendamento feito pelo cliente confirma a entrada na fila, mas não comprova que a viatura já foi entregue. Quando o cliente chega ao estabelecimento, um funcionário ou administrador confirma a receção no painel operacional. A confirmação identifica a conta e a hora, coloca a viatura em espera e disponibiliza ao cliente um comprovativo descarregável; o ficheiro também permite imprimir ou guardar como PDF. Este documento comprova apenas a receção, não o pagamento nem a conclusão da lavagem.

### Partilha do Lava Já

O botão **«Partilhar o Lava Já»**, disponível na página inicial e junto às lavagens concluídas no painel do cliente, usa o menu de partilha do dispositivo quando disponível. Caso contrário, oferece atalhos para WhatsApp, Facebook e Telegram, além de copiar o endereço do site. Em desenvolvimento local, o endereço `localhost` só funciona no computador que está a executar a aplicação; para os clientes acederem, partilhe o endereço público do ngrok ou configure um domínio.

---

## 2. Acesso e autenticação

Os utilizadores iniciam sessão individualmente em `/login` com o endereço de email e a palavra-passe da sua conta. O cliente é encaminhado para a área de cliente, o funcionário para a área operacional e o administrador para o painel de gestão. As permissões são também verificadas pela API; terminar sessão remove o token guardado no navegador. Cada utilizador pode alterar a sua palavra-passe em `/seguranca`, confirmando a palavra-passe atual. Funcionários criados pelo gestor têm de substituir a palavra-passe inicial por uma pessoal antes de aceder às restantes áreas, com o bloqueio também aplicado pela API. Na gestão de funcionários, o gestor pode editar o perfil e desativar ou reativar o acesso sem apagar a conta nem o histórico associado; as sessões existentes são invalidadas quando o estado muda.

As contas e os respetivos dados permanecem na base de dados atual. As palavras-passe não são documentadas nem incluídas no código: configure-as por um processo administrativo seguro e utilize palavras-passe únicas antes de colocar o sistema em produção. As credenciais antigas de desenvolvimento não devem ser reutilizadas em produção.

O segredo JWT deve ser definido em `server/.env` com um valor aleatório único de, pelo menos, 32 caracteres. Não reutilize o valor de exemplo. A alteração do segredo invalida as sessões JWT existentes.

---

## 3. Arquitetura de Tecnologias

### Frontend
- **Framework:** React 19 + Vite 8
- **Estilização:** Tailwind CSS v4, com tipografia Inter e layout responsivo em tons de azul, branco e verde
- **Navegação:** React Router DOM v7
- **Ícones:** Lucide React
- **Arquitetura:** Componentes modulares, AuthContext reativo e consumo de API REST.

### Backend
- **Ambiente:** Node.js v24 + Express 5
- **Autenticação:** JWT (JSON Web Tokens) com controlo de permissões por perfil (`requireRole`)
- **Segurança:** Senhas com hash `bcryptjs`, consultas SQL parametrizadas prevenindo SQL Injection, isolamento rigoroso de dados entre clientes.

### Persistência de Dados
- **Base de Dados Principal:** SQLite através do módulo de alta performance `better-sqlite3` com WAL mode (Write-Ahead Logging) ativo e integridade referencial por chaves forasteiras.
- **Ficheiro de Persistência:** `server/lavaja.db` (garante persistência integral entre reinícios do servidor).
- **Motor configurado:** SQLite. Apesar de o modelo usar tabelas relacionais, não existe configuração ativa para trocar o SQLite por PostgreSQL através de variáveis de ambiente.

---

## 4. Instruções de Instalação e Execução

### Pré-requisitos
- Node.js (v20.19+ ou v22.12+)
- NPM

### Passo 1: Instalar dependências
Na pasta raiz do projeto:
```bash
npm run install:all
```

### Passo 2: Configurar o backend
Crie `server/.env` a partir de `server/.env.example` e defina um segredo JWT exclusivo. No PowerShell:
```powershell
Copy-Item server\.env.example server\.env
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Copie o valor gerado para `JWT_SECRET` em `server/.env`. O ficheiro também permite configurar `PORT` (predefinição `5000`), `DB_PATH` (predefinição `./lavaja.db`) e, opcionalmente, `GEMINI_API_KEY` ou `OPENAI_API_KEY`. Não partilhe nem versione `server/.env`.

A aplicação cria e atualiza o esquema SQLite ao iniciar. Os dados de teste do `server/seed.js` são exclusivos da suíte automatizada e não devem ser usados para inicializar a base comercial. Configure os serviços e os dados do negócio através da aplicação depois de preparar o acesso de administrador.

### Passo 3: Iniciar os serviços
Abra dois terminais na pasta raiz do projeto:

Terminal 1 — backend:
```bash
npm run server
```

Para desenvolvimento com reinício automático, use `cd server` e `npm run dev`.

Terminal 2 — frontend:
```bash
npm run client
```

O frontend fica disponível em **`http://localhost:3000`** e encaminha pedidos `/api` para o backend em **`http://localhost:5000`**.

---

## 5. Execução dos Testes Automatizados

O projecto inclui uma suíte completa de testes automatizados (`server/test/runner.js`) que valida as regras críticas de negócio:

Na pasta raiz, execute a suíte automatizada do backend:
```bash
npm test
```

Os testes usam uma base SQLite temporária isolada, criada e reposta pelo runner; não alteram `server/lavaja.db`. Para compilar o frontend, execute `npm run build:client`. Para verificar o lint, execute `npm --prefix client run lint`.

---

## 6. Cobranças e comprovativos

### Comprovativo de receção da viatura

1. O cliente pode reservar de casa e acompanhar a marcação na fila; a reserva, por si só, não emite um comprovativo de entrega.
2. No estabelecimento, funcionário ou administrador inicia sessão e confirma **«Confirmar receção»**. A API valida o perfil, regista a conta e a hora e coloca a viatura em espera.
3. Para reservas associadas a uma conta, o comprovativo fica disponível no painel desse cliente e no painel operacional para descarregar. Reservas sem sessão não ficam associadas a um painel de cliente; o funcionário pode consultar e descarregar o comprovativo no painel operacional.
4. O documento identifica a referência da reserva, o cliente, a viatura, o serviço, quem recebeu e a hora; pode ser impresso ou guardado como PDF.
5. O registo de uma lavagem presencial já concluída também guarda o funcionário responsável e disponibiliza o comprovativo no registo operacional.

### Comprovativo de pagamento

1. O cliente cria a marcação sem pagar antecipadamente.
2. O funcionário inicia e conclui a lavagem. A conclusão atribui os pontos uma única vez, mas mantém a cobrança pendente.
3. Depois da conclusão, o cliente ou funcionário abre **«Proceder ao Pagamento»**. O preço cobrado é o preço guardado quando a marcação foi criada, mesmo que o catálogo seja alterado depois.
4. Promoções válidas para a data do serviço ficam registadas na marcação. Um voucher do Passaporte pode acumular com essa promoção; o backend valida o titular, a validade, o estado e o serviço aplicável, limita o desconto ao preço e só consome o voucher na mesma transação em que confirma o pagamento.
5. As recompensas de serviço (por exemplo, cera ou ambientador) aparecem como benefícios separados; não são confundidas com pontos convertidos em dinheiro. Uma recompensa de serviço associada a uma lavagem gratuita aplica-se apenas ao serviço correspondente.
6. M-Pesa, e-Mola, mKesh e Moza Banco são **simulações sem integração financeira**. O pagamento no balcão só pode ser confirmado por funcionário ou administrador, depois de receber o valor. O comprovativo distingue pagamentos simulados dos recebimentos no balcão.

## 7. Assistente de Inteligência Artificial — Modos de Funcionamento

O assistente foi projectado para operar em dois modos:

1. **Modo Demonstrativo Local Inteligente (Padrão - Sem custos):**
   - Motor conversacional treinado com intenções em português natural de Moçambique.
   - **Consulta direta à base de dados real:** Preços actualizados, horários de funcionamento, verificação em tempo real de horários e vagas livres e localização na Matola.
   - Não alucina dados nem inventa preços.
2. **Modo Conectado a Modelo de Linguagem (Opcional):**
   - Para ligar a uma chave externa de IA generativa, adicione ao ficheiro `server/.env`:
     ```env
     GEMINI_API_KEY=sua_chave_gemini_aqui
     # ou
     OPENAI_API_KEY=sua_chave_openai_aqui
     ```

---

## 8. Relação de Integrações: Reais vs Simuladas

| Funcionalidade | Estado da Integração | Descrição Técnica |
| :--- | :---: | :--- |
| **Persistência de Dados** | **REAL** | SQLite em disco (`lavaja.db`) com transações atómicas e integridade relacional. |
| **Cálculo de Capacidade** | **REAL** | Algoritmo que calcula ocupação concorrente das 3 vagas por intervalos de tempo. |
| **Atribuição de Pontos** | **REAL** | Débito/crédito atómico na tabela `loyalty_accounts` e histórico de transações. |
| **Autenticação & JWT** | **REAL** | Tokens criptografados, verificação de cabeçalho `Authorization: Bearer`. |
| **Assistente Conversacional**| **REAL** | Processamento de intenções via `/api/ai-assistant/chat` apoiado na base de dados. |
| **Notificações** | **SIMULADA (Interna)**| Sistema de notificações interno com central e badges (sem envio de SMS/WhatsApp externo para não gerar custos). |
| **Google Maps** | **REAL** | Links e pesquisa direta com coordenadas GPS da Matola. |
| **Pagamentos eletrónicos** | **SIMULADOS (sem cobrança)** | Após a lavagem concluída, M-Pesa, e-Mola, mKesh e Moza Banco geram um comprovativo demonstrativo local. Nenhum fornecedor é contactado nem dinheiro movimentado. |
| **Pagamento no balcão** | **Registo interno** | Funcionário ou administrador autorizado regista o valor recebido presencialmente e emite um comprovativo. |
| **Vouchers do Passaporte VIP** | **REAL (na aplicação)** | Resgates deduzem pontos, geram um código de utilização única e só são consumidos atomicamente quando o pagamento associado é confirmado. |

---

## 9. Roteiro de Apresentação e Demonstração

### Passo 1: Captação de Clientes (Página Inicial Pública)
1. Mostre a **Página Inicial**: design moderno, cores do sector automóvel, tabela de serviços e preços em Meticais (MT).
2. Mostre o banner de campanhas ativas e a capacidade de atendimento simultâneo configurada para o estabelecimento.
3. Clique em **«Como Chegar»** para abrir a rota no Google Maps.

### Passo 2: O Assistente Lava Já Matola
1. Clique no botão flutuante **«Assistente Lava Já Matola»** no canto inferior direito.
2. Escreva: *"Quais são os preços das lavagens?"* — O assistente responde com os valores reais da base de dados.
3. Escreva: *"Têm horários para amanhã?"* — O assistente calcula os slots vagos e sugere agendamento imediato com botão de ação.

### Passo 3: Efetuar uma Marcação
1. Vá a **«Marcar Lavagem»**.
2. Na etapa 1, escolha **Lavagem Completa (450 MT)**, a data e um horário disponível; a barra de progresso mostra 50%.
3. Clique em **«Avançar»** para abrir a etapa 2, que mostra 100% de progresso.
4. Preencha os dados da viatura, aplique o código promocional `MATOLA15` se estiver ativo e confirme.
5. Veja a referência da reserva e a vaga atribuída.

### Passo 4: Fila ao Vivo
1. Aceda a **«Fila ao Vivo»** para consultar os registos do dia e distinguir viaturas prontas para levantamento das reservas e atendimentos.

### Passo 5: Painel Operacional (Funcionário)
1. Inicie sessão em `/login` com as credenciais da conta individual de funcionário.
2. Use os atalhos **«Reservas»** e **«Registar lavagem»** para ir diretamente às respetivas áreas.
3. Na lista de reservas, pesquise por matrícula ou referência e use os filtros de estado.
4. Abra **«Ver detalhes»** para consultar contacto, viatura, serviço, preço, horário, estado do pagamento, funcionário que recebeu a viatura e observações.
5. Quando o cliente entregar a viatura, clique em **«Confirmar receção»**. O sistema regista quem a recebeu e a hora; depois, pode descarregar o **recibo de receção**, que não é comprovativo de pagamento.
6. Se a reserva ainda não foi recebida e não começou o atendimento, **«Cancelar reserva»** permite ao funcionário cancelar após confirmação. Reservas recebidas, em atendimento ou concluídas não podem ser canceladas pelo cliente; o servidor valida as permissões e o estado.
7. Clique em **«Iniciar lavagem»** e depois em **«Concluir lavagem»**. A conclusão atribui os pontos uma única vez e deixa a cobrança pendente.
8. Na reserva concluída, clique em **«Registar pagamento»**; aplique um voucher elegível e selecione uma carteira simulada ou confirme o valor recebido no balcão. Se já estiver pago, o botão permite consultar o pagamento.
9. O **comprovativo de pagamento** mostra o método, o desconto, o total e se o pagamento foi simulado. É um documento separado do recibo de receção.

Se o cliente chegar sem uma reserva, use **«Registar lavagem»** para registar a lavagem presencial já concluída, procurar a conta de fidelização pelo telefone e emitir o recibo de receção para o registo.

### Passo 6: Passaporte VIP (Cliente)
1. Termine a sessão atual e inicie sessão com as credenciais da conta individual do cliente.
2. Veja a notificação de serviço concluído na campainha.
3. Aceda a **«Passaporte VIP»**, veja o saldo de pontos aumentado e clique em **«Resgatar Recompensa»** para gerar um novo voucher com código.
4. Use o voucher numa cobrança pendente elegível; os benefícios de serviço e os descontos em MT são apresentados separadamente.
![alt text](image.png)
### Passo 7: Painel do Gestor (Administrador)
1. Termine a sessão atual e inicie sessão com as credenciais da conta individual do administrador.
2. Analise os KPIs de faturação diária, clientes novos vs recorrentes e horários de pico.
3. No separador **«Serviços & Preços»**, altere o preço de um serviço e veja a atualização instantânea em toda a plataforma.
4. No separador **«Relatórios»**, escolha um período para consultar lavagens, pagamentos recebidos, simulações, descontos e fidelização; exporte os dados em CSV.
5. Os pagamentos simulados aparecem separados e não contam como dinheiro recebido.
6. A base comercial não tem uma opção de reposição na aplicação. Os fixtures automatizados são isolados na base de testes e não alteram a base comercial.

---
**Lava Já Matola • 2026**
