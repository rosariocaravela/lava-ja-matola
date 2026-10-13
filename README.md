# 🚗 Lava Já Matola — Lavagem rápida e de confiança

> **Plataforma Digital para Lavagem Automóvel e Fidelização de Clientes**  
> **Localização do Estabelecimento:** Av. da Matola, Paragem Padaria, Matola, Moçambique (UTC+2)

---

## 1. Visão Geral

O **Lava Já Matola** é uma plataforma digital completa criada para modernizar e dinamizar o negócio de lavagem automóvel (car wash) na Matola, respondendo a dois desafios centrais:

1. **Captação de Novos Clientes:** Acesso digital transparente aos serviços, horários e preços em Meticais (MT), localização integrada com rota no Google Maps e agendamento inteligente sem conflitos de capacidade.
2. **Fidelização Contínua:** O programa **«Passaporte Lava Já»** credita 10 pontos de boas-vindas, 10 pontos por lavagem básica, 20 por completa, 25 por lavagem de motor, 30 por lavagem premium e 40 por higienização especializada. Após a primeira lavagem concluída, credita mais 10 pontos a cada três semanas. As recompensas custam 50, 100, 150 ou 200 pontos.

A solução dispõe de um **Assistente de Inteligência Artificial conversacional**, gestão de 3 vagas simultâneas de lavagem, notificações de conclusão, fila ao vivo com estimativa dinâmica de tempo de espera e painéis dedicados para **Cliente**, **Funcionário** e **Administrador / Gestor**.

---

## 2. Credenciais de Acesso de Demonstração

Para facilitar a exploração e teste da plataforma, as contas de demonstração já vêm semeadas na base de dados (com hash seguro bcrypt):

| Perfil | Nome | Email | Palavra-passe | Funcionalidade Principal |
| :--- | :--- | :--- | :--- | :--- |
| **Cliente VIP** | Inácio Cumbane | `cliente@lavaja.co.mz` | `cliente123` | Agendamentos, Saldo Passaporte (30 pts), Vouchers, Histórico |
| **Funcionário** | Carlos Matsinhe | `funcionario@lavaja.co.mz` | `func123` | Operador de vagas, Iniciar/Concluir lavagem, Validar vouchers |
| **Administrador** | Nelson Mandlate | `admin@lavaja.co.mz` | `admin123` | Dashboard de KPIs, Edição de preços, Promoções, Capacidade |

> 💡 **Dica de Alternância Rápida:** No topo da aplicação (Barra Superior e Ecrã de Login), existe o menu **«Alternar Perfil Demo»** que permite entrar instantaneamente em qualquer uma das três contas com 1 clique!

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
- Node.js (v18 ou superior instalado)
- NPM

### Passo 1: Inicializar o Backend
Abra um terminal na pasta do projecto:
```bash
cd server
npm install
npm run seed      # Inicializa a base de dados com o cenário completo do Lava Já Matola
npm start         # Inicia o servidor na porta 5000 (http://localhost:5000)
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
  ✅ PASS: Regras de Disponibilidade: Fora de Horário de Funcionamento
  ✅ PASS: Regras de Disponibilidade: Rejeição de Datas Passadas
  ✅ PASS: Regras de Capacidade e Conflitos de Reserva (Limite de 3 vagas simultâneas)
  ✅ PASS: Fluxo e Alteração de Estados da Lavagem (reservado -> aguardando -> em_atendimento -> concluido)
  ✅ PASS: Atribuição Única de Pontos de Fidelização (Sem duplicação)
  ✅ PASS: Resgate de Recompensa: Validação de Saldo e Prevenção de Saldo Negativo
  ✅ PASS: Validação de Promoções: Códigos Ativos vs Expirados
  ✅ PASS: Isolamento de Dados: Cliente não acede a dados de outros clientes
  ✅ PASS: Controlo de Acesso por Perfil (JWT e Roles)

🧪 ===============================================
🧪 RESULTADO DOS TESTES: 10 PASSOU | 0 FALHOU
🧪 ===============================================
```

---

## 6. Assistente de Inteligência Artificial — Modos de Funcionamento

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

## 7. Relação de Integrações: Reais vs Simuladas

| Funcionalidade | Estado da Integração | Descrição Técnica |
| :--- | :---: | :--- |
| **Persistência de Dados** | **REAL** | SQLite em disco (`lavaja.db`) com transações atómicas e integridade relacional. |
| **Cálculo de Capacidade** | **REAL** | Algoritmo que calcula ocupação concorrente das 3 vagas por intervalos de tempo. |
| **Atribuição de Pontos** | **REAL** | Débito/crédito atómico na tabela `loyalty_accounts` e histórico de transações. |
| **Autenticação & JWT** | **REAL** | Tokens criptografados, verificação de cabeçalho `Authorization: Bearer`. |
| **Assistente Conversacional**| **REAL** | Processamento de intenções via `/api/ai-assistant/chat` apoiado na base de dados. |
| **Notificações** | **SIMULADA (Interna)**| Sistema de notificações interno com central e badges (sem envio de SMS/WhatsApp externo para não gerar custos). |
| **Google Maps** | **REAL** | Links e pesquisa direta com coordenadas GPS da Matola. |
| **Pagamentos / M-Pesa** | **SIMULADA** | Valores reais registados em MT, sem débito bancário real de telecomunicações. |

---

## 8. Roteiro de Apresentação e Demonstração

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
1. Na barra superior, clique em **«Alternar Perfil Demo»** → **Funcionário**.
2. Veja o serviço na lista. Clique em **«Iniciar Lavagem»** e depois em **«Concluir Lavagem»**.
3. O veículo é marcado como pronto e os pontos de fidelização são atribuídos ao cliente automaticamente uma única vez!
4. Valide um voucher de desconto introduzindo o código no validador.

### Passo 6: Passaporte VIP (Cliente)
1. Alterne para **Cliente (Inácio Cumbane)**.
2. Veja a notificação de serviço concluído na campainha.
3. Aceda a **«Passaporte VIP»**, veja o saldo de pontos aumentado e clique em **«Resgatar Recompensa»** para gerar um novo voucher com código.

### Passo 7: Painel do Gestor (Administrador)
1. Alterne para **Gestor (Nelson Mandlate)**.
2. Analise os KPIs de faturação diária, clientes novos vs recorrentes e horários de pico.
3. No separador **«Serviços & Preços»**, altere o preço de um serviço e veja a atualização instantânea em toda a plataforma.
4. Se necessário, use **«Repor Dados Iniciais»** para reiniciar a demonstração a qualquer momento.

---
**Lava Já Matola • 2026**
