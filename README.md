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

O agendamento é apresentado em duas etapas. Na primeira, o cliente escolhe a modalidade — **nas instalações Lava Já** ou **no local indicado pelo cliente** —, o serviço, a data e um horário disponível. As modalidades têm disponibilidade independente: a primeira respeita as vagas e o horário do estabelecimento; a segunda agenda uma equipa móvel, usa um horário de atendimento próprio e exige o endereço de destino. Só é permitido um atendimento móvel de cada vez. O administrador configura o início e o fim do atendimento móvel nas configurações do estabelecimento. As condições de água e energia ainda não fazem parte desta versão. O botão **«Avançar»** só fica ativo depois de selecionar serviço e horário. A página atualiza a disponibilidade a cada 15 segundos e quando volta a ficar ativa; o servidor valida novamente a disponibilidade ao confirmar. Na segunda etapa, o cliente preenche os dados da viatura e contacto, pode aplicar um código promocional e confirma a marcação. É possível voltar para alterar serviço, modalidade ou horário.

Uma marcação nas instalações não comprova que a viatura já foi entregue. Quando o cliente chega ao estabelecimento, um funcionário ou administrador confirma a receção no painel operacional. A confirmação identifica a conta e a hora, coloca a viatura em espera e disponibiliza ao cliente um comprovativo descarregável. Na modalidade no local, não há receção da viatura no balcão; o endereço informado fica visível no painel operacional. O comprovativo de marcação não comprova pagamento nem conclusão da lavagem.

No painel do cliente, cada marcação ativa mostra a posição prevista e quantas marcações do mesmo dia e modalidade têm horário anterior. A contagem é privada: não apresenta nomes, matrículas nem referências de outros clientes. A fila pública (`/api/queue`) também apresenta apenas totais agregados. Reservas concluídas ou canceladas deixam de contar; o painel atualiza a posição a cada 15 segundos. A posição segue a ordem dos horários e não é uma estimativa de espera; atendimentos podem ocorrer em simultâneo conforme a capacidade das vagas.

### Partilha do Lava Já

O botão **«Partilhar o Lava Já»**, disponível na página inicial, usa o menu de partilha do dispositivo quando disponível. Caso contrário, oferece atalhos para WhatsApp, Facebook e Telegram, além de copiar o endereço do site. Em desenvolvimento local, o endereço `localhost` só funciona no computador que está a executar a aplicação; para os clientes acederem, partilhe o endereço público do ngrok ou configure um domínio.

---

## 2. Acesso e autenticação

Os utilizadores iniciam sessão individualmente em `/login` com o endereço de email e a palavra-passe da sua conta. O cliente é encaminhado para a área de cliente, o funcionário para a área operacional e o administrador para o painel de gestão. As permissões são também verificadas pela API; terminar sessão remove o token guardado no navegador. Cada utilizador pode alterar a sua palavra-passe em `/seguranca`, confirmando a palavra-passe atual. Funcionários criados pelo gestor têm de substituir a palavra-passe inicial por uma pessoal antes de aceder às restantes áreas, com o bloqueio também aplicado pela API. Na gestão de funcionários, o gestor pode editar o perfil e desativar ou reativar o acesso sem apagar a conta nem o histórico associado; as sessões existentes são invalidadas quando o estado muda.

As contas e os respetivos dados permanecem na base de dados atual. As palavras-passe não são documentadas nem incluídas no código: configure-as por um processo administrativo seguro e utilize palavras-passe únicas antes de colocar o sistema em produção. As credenciais antigas de desenvolvimento não devem ser reutilizadas em produção.

O segredo JWT deve ser definido em `server/.env` com um valor aleatório único de, pelo menos, 32 caracteres. Não reutilize o valor de exemplo. A alteração do segredo invalida as sessões JWT existentes.

Para criar o primeiro administrador no Render, configure `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL` e `INITIAL_ADMIN_PASSWORD` nas variáveis de ambiente do serviço backend e faça um novo deploy. A palavra-passe deve ter pelo menos 12 caracteres. O administrador só é criado se o email ainda não existir; reinícios não alteram uma conta existente, e uma conta com esse email que não seja administradora causa erro explícito. Guarde as credenciais apenas no gestor de variáveis do Render, nunca no GitHub. Depois do primeiro acesso, pode remover as três variáveis do serviço e fazer novo deploy; a conta permanece na base de dados.

A recuperação da palavra-passe envia um link de utilização única, válido por 30 minutos. Para a activar, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` e `CLIENT_PUBLIC_URL` em `server/.env`, usando credenciais SMTP próprias e uma URL pública HTTPS em produção. Sem SMTP configurado, o pedido de recuperação apresenta uma mensagem de indisponibilidade e não envia email.

O projecto não contém uma integração oficial com o Moza Banco. `MOZABANCO_SIMULATION_ENABLED` e `MOZABANCO_DISCOUNT_ENABLED` ficam desativados por predefinição. Só os active para testes demonstrativos; o desconto de 10% só deve ser activado após autorização comercial e não representa uma transacção bancária real.

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
6. M-Pesa, e-Mola e mKesh são **simulações sem integração financeira**. Moza Banco fica indisponível por predefinição; em modo de teste, a simulação pode calcular 10% sobre o valor restante após promoção e voucher, sem contactar o banco nem movimentar dinheiro. O desconto é controlado pelas variáveis `MOZABANCO_SIMULATION_ENABLED` e `MOZABANCO_DISCOUNT_ENABLED` e deve permanecer desligado até à integração oficial e à autorização comercial. O pagamento no balcão só pode ser confirmado por funcionário ou administrador, depois de receber o valor. O comprovativo distingue pagamentos simulados dos recebimentos no balcão.

### Campanha de benefícios Lava Já Matola × Moza Banco

O painel do cliente apresenta o progresso de transações confirmadas, o benefício disponível e o histórico de utilização. A regra inicial é configurável por `MOZA_BENEFIT_TRANSACTION_TARGET` (5 transações), `MOZA_BENEFIT_DISCOUNT_PERCENTAGE` (10%), `MOZA_BENEFIT_MIN_TRANSACTION_MZN` (valor mínimo elegível) e `MOZA_BENEFIT_VALIDITY_DAYS` (0 significa sem prazo de validade). As transações canceladas ou revertidas deixam de contar antes de o benefício ser usado; se a reversão acontecer depois de o desconto ser consumido, não se recupera retroativamente o desconto aplicado. Depois da utilização inicia-se automaticamente um novo ciclo.

Este repositório não dispõe de API ou confirmação oficial do Moza Banco. Por isso, M-Pesa, e-Mola, mKesh e a opção demonstrativa Moza não contam para a campanha. O frontend não permite inserir transações. O backend só aceita eventos no endpoint interno `/api/loyalty/moza/transaction-events` quando `MOZA_TRANSACTION_WEBHOOK_SECRET` está configurado com pelo menos 32 bytes e o pedido tem `X-Moza-Timestamp` (Unix em segundos) e `X-Moza-Signature` (HMAC-SHA256 hexadecimal sobre `timestamp + "." + JSON.stringify(body)`). A janela de timestamp aceite é de cinco minutos. O adaptador futuro deve validar a confirmação oficial, associar o identificador interno do cliente sem expor o PAN/cartão, enviar um `event_id` e `provider_transaction_id` estáveis, e retransmitir cancelamentos/reversões com nova identificação de evento. A aplicação protege repetição pelo identificador do evento e pela referência única de transação, e regista auditoria.

Não configure este segredo até existir um canal autorizado e seguro com o banco. A configuração do segredo, por si só, não representa uma integração nem autorização comercial. Um benefício real pode ser reclamado pelo cliente e aplicado uma vez numa lavagem; enquanto pagamentos digitais forem demonstrativos, a confirmação do desconto Moza exige registo de pagamento real no balcão por funcionário autorizado. Não são solicitados nem armazenados número completo de cartão, CVV, PIN ou palavra-passe bancária. O ficheiro `credit-card-form.tsx` referido como referência visual não existe neste repositório; a experiência visual usa o `PaymentPanel.jsx` existente.

## Publicação de fotografias

O gestor pode carregar fotografias no separador **Fotografias** do painel administrativo. São aceites imagens JPEG, PNG e WebP até 5 MB; cada fotografia precisa de título, descrição alternativa e confirmação de autorização para a divulgação pública, incluindo consentimento das pessoas ou matrículas identificáveis. As imagens carregadas permanecem privadas até o gestor as aprovar; podem ser retiradas do site ou removidas. O site público mostra apenas fotografias aprovadas. Os ficheiros ficam em `server/uploads/gallery` por predefinição; inclua essa pasta nas cópias de segurança e use armazenamento persistente no ambiente de produção.

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
| **Localização por GPS** | **REAL (uma unidade)** | Com autorização do navegador, calcula a distância em linha reta até à unidade configurada e abre a rota de condução no Google Maps. Requer HTTPS em produção; a aplicação ainda não mantém uma lista de sucursais para encontrar a mais próxima entre várias unidades. |
| **Pagamentos eletrónicos** | **SIMULADOS (sem cobrança)** | Após a lavagem concluída, M-Pesa, e-Mola e mKesh podem gerar um comprovativo demonstrativo local. Moza Banco e o seu desconto ficam desligados por predefinição; a simulação Moza só pode ser activada para testes e não contacta o banco nem movimenta dinheiro. |
| **Pagamento no balcão** | **Registo interno** | Funcionário ou administrador autorizado regista o valor recebido presencialmente e emite um comprovativo. |
| **Vouchers do Passaporte VIP** | **REAL (na aplicação)** | Resgates deduzem pontos, geram um código de utilização única e só são consumidos atomicamente quando o pagamento associado é confirmado. |

---

## 9. Roteiro de Apresentação e Demonstração

### Passo 1: Captação de Clientes (Página Inicial Pública)
1. Mostre a **Página Inicial**: design moderno, cores do sector automóvel, tabela de serviços e preços em Meticais (MT).
2. Mostre o banner de campanhas ativas e a capacidade de atendimento simultâneo configurada para o estabelecimento.
3. Clique em **«Calcular distância com GPS»** e permita a localização no navegador para ver a distância aproximada até à unidade configurada; depois abra a rota no Google Maps. A distância apresentada é em linha reta. Em produção, a localização do navegador exige HTTPS. Como só há uma unidade cadastrada, ainda não é possível comparar várias sucursais.

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

### Passo 4: Acompanhamento da Fila
1. No painel do cliente, consulte a posição prevista da sua marcação e quantas marcações têm horário anterior. A informação é privada e não identifica outros clientes.
2. O painel atualiza a contagem a cada 15 segundos; quando o funcionário conclui uma lavagem, ela deixa de contar como ativa.

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
