# 🚗 Lava Já Matola — Lavagem rápida e de confiança

> **Plataforma Digital para Lavagem Automóvel e Fidelização de Clientes**  
> **Localização do Estabelecimento:** Av. da Matola, Paragem Padaria, Matola, Moçambique (UTC+2)

---

## 1. Visão Geral

O **Lava Já Matola** é uma platafoddrma digital completa criada para modernizar e dinamizar o negócio de lavagem automóvel (car wash) na Matola, respondendo a dois desafios centrais:

1. **Captação de Novos Clientes:** Acesso digital transparente aos serviços, horários e preços em Meticais (MT), localização integrada com rota no Google Maps e agendamento inteligente sem conflitos de capacidade.
2. **Fidelização Contínua:** O programa **«Passaporte Lava Já»** credita 10 pontos de boas-vindas, 10 pontos por lavagem básica, 20 por completa, 25 por lavagem de motor, 30 por lavagem premium e 40 por higienização especializada. Após a primeira lavagem concluída, credita mais 10 pontos a cada três semanas. As recompensas custam 50, 100, 150 ou 200 pontos.
3. **Cobrança após o serviço:** A marcação não exige pagamento antecipado. Após a conclusão, o cliente ou funcionário autorizado consulta a cobrança, acumula promoções e descontos elegíveis, aplica um voucher uma única vez e regista a simulação eletrónica ou o valor recebido no balcão.

A solução dispõe de um **Assistente de Inteligência Artificial conversacional**, gestão de 3 vagas simultâneas de lavagem, notificações de conclusão, fila ao vivo com estimativa dinâmica de tempo de espera, comprovativos de pagamento e painéis dedicados para **Cliente**, **Funcionário** e **Administrador / Gestor**.

---

## 2. Acesso e autenticação

Os utilizadores iniciam sessão individualmente em `/login` com o endereço de email e a palavra-passe da sua conta. O cliente é encaminhado para a área de cliente, o funcionário para a área operacional e o administrador para o painel de gestão. As permissões são também verificadas pela API; terminar sessão remove o token guardado no navegador. Cada utilizador pode alterar a sua palavra-passe em `/seguranca`, confirmando a palavra-passe atual. Funcionários criados pelo gestor têm de substituir a palavra-passe inicial por uma pessoal antes de aceder às restantes áreas, com o bloqueio também aplicado pela API. Na gestão de funcionários, o gestor pode editar o perfil e desativar ou reativar o acesso sem apagar a conta nem o histórico associado; as sessões existentes são invalidadas quando o estado muda.

As contas e os respetivos dados permanecem na base de dados atual. As palavras-passe não são documentadas nem incluídas no código: configure-as por um processo administrativo seguro e utilize palavras-passe únicas antes de colocar o sistema em produção. As credenciais antigas de desenvolvimento não devem ser reutilizadas em produção.

O segredo JWT deve ser definido em `server/.env` com um valor aleatório único de, pelo menos, 32 caracteres. Não reutilize o valor de exemplo. A alteração do segredo invalida as sessões JWT existentes.

---

## 3. Arquitetura de Tecnologias

### Frontend
- **Framework:** React 19 + Vite 8
- **Estilização:** Tailwind CSS v4 (Design moderno e automotivo em tons de azul, branco e verde)
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
- **Compatibilidade PostgreSQL:** O schema foi modelado de acordo com o padrão relacional (tabelas `users`, `services`, `reservations`, `loyalty_accounts`, `rewards`, `promotions`, `notifications`, `business_settings`, etc.) e pode ser migrado diretamente via variáveis de ambiente.

---

## 4. Instruções de Instalação e Execução

### Pré-requisitos
- Node.js (v18.11 ou superior instalado para o modo de desenvolvimento)
- NPM

### Passo 1: Inicializar o Backend
Abra um terminal na pasta do projecto:
```bash
cd server
npm install
npm run seed      # Inicializa a base de dados com o cenário completo do Lava Já Matola
npm run dev       # Desenvolvimento: reinicia o servidor quando os arquivos mudam
# ou npm start    # Início normal, sem reinicialização automática
```

### Passo 2: Inicializar o Frontend
Abra um segundo terminal:
```bash
cd client
npm install
npm run dev       # Inicia a aplicação web na porta 3000 (http://localhost:3000)
```

Abra o seu navegador em: **`http://localhost:3000`**

---

## 5. Execução dos Testes Automatizados

O projecto inclui uma suíte completa de testes automatizados (`server/test/runner.js`) que valida as regras críticas de negócio:

Para executar os testes:
```bash
cd server
npm test
```

### Resultados dos Testes Reais:
```text
🧪 ===============================================
🧪 INICIANDO SUÍTE DE TESTES AUTOMATIZADOS: LAVA JÁ MATOLA
🧪 ===============================================
  ✅ PASS: Inicialização e Seeding da Base de Dados
  ✅ PASS: Novo registo recebe apenas os pontos de boas-vindas definidos
  ✅ PASS: Bónus de três semanas começa após a primeira lavagem concluída e não duplica
  ✅ PASS: Movimentos antigos são reduzidos às regras atuais e os saldos ajustados
  ✅ PASS: Regras de Disponibilidade: Fora de Horário de Funcionamento
  ✅ PASS: Regras de Disponibilidade: Rejeição de Datas Passadas
  ✅ PASS: Regras de Capacidade e Conflitos de Reserva
  ✅ PASS: Fluxo e Alteração de Estados da Lavagem
  ✅ PASS: Atribuição Única de Pontos de Fidelização (Sem duplicação)
  ✅ PASS: Resgate de Recompensa: Validação de Saldo e Prevenção de Saldo Negativo
  ✅ PASS: Validação de Promoções: Códigos Ativos vs Expirados
  ✅ PASS: Isolamento de Dados: Cliente não acede a dados de outros clientes
  ✅ PASS: Controlo de Acesso por Perfil (JWT e Roles)
  ✅ PASS: Fluxo de cobrança pós-lavagem, vouchers, pagamentos e permissões

🧪 ===============================================
🧪 RESULTADO DOS TESTES: 14 PASSOU | 0 FALHOU
🧪 ===============================================
```

---

## 6. Cobranças e comprovativos

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
2. Mostre o banner de campanhas ativas com o código `QUARTA20` (20% OFF) e a ocupação em direto das 3 vagas da Matola.
3. Clique em **«Como Chegar»** para abrir a rota no Google Maps.

### Passo 2: O Assistente Lava Já Matola
1. Clique no botão flutuante **«Assistente Lava Já Matola»** no canto inferior direito.
2. Escreva: *"Quais são os preços das lavagens?"* — O assistente responde com os valores reais da base de dados.
3. Escreva: *"Têm horários para amanhã?"* — O assistente calcula os slots vagos e sugere agendamento imediato com botão de ação.

### Passo 3: Efetuar uma Marcação
1. Vá a **«Marcar Lavagem»**.
2. Escolha **Lavagem Completa (450 MT)** e a data de hoje.
3. Veja os horários disponíveis a serem calculados pela capacidade simultânea.
4. Preencha a matrícula (ex: `AEL 123 MP`) e o código promocional `MATOLA15`.
5. Confirme e veja a emissão imediata da referência (ex: `LJ-XXXX`) e vaga atribuída.

### Passo 4: Fila ao Vivo
1. Aceda a **«Fila ao Vivo»** e mostre as 3 vagas de atendimento com estimativa dinâmica de tempo de espera.

### Passo 5: Painel Operacional (Funcionário)
1. Inicie sessão em `/login` com as credenciais da conta individual de funcionário.
2. Veja o serviço na lista. Clique em **«Iniciar Lavagem»** e depois em **«Concluir Lavagem»**.
3. O veículo é marcado como pronto, os pontos são atribuídos uma única vez e o pagamento fica pendente.
4. Abra **«Proceder ao Pagamento»**, aplique um voucher elegível e selecione uma carteira simulada ou confirme um valor recebido no balcão.
5. Consulte o comprovativo, que mostra o método, o desconto, o total e se o pagamento foi simulado.

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
