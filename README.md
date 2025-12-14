# Backend de Integração com Mercado Pago (Node.js/Express)

Este projeto implementa um backend em Node.js com Express para:
1.  Integrar a criação de pagamentos (Checkout Pro) do Mercado Pago.
2.  Receber notificações de Webhook do Mercado Pago.
3.  **Enviar um arquivo PDF por e-mail** ao comprador após a confirmação do pagamento.
4.  **Rastrear pedidos** usando o `external_reference`.

## Pré-requisitos

*   Node.js (versão 14 ou superior)
*   Conta de desenvolvedor no Mercado Pago com credenciais de Sandbox ou Produção.
*   Conta de e-mail configurada para envio via SMTP (ex: Gmail com "Senha de App").

## Configuração

1.  **Instale as dependências:**
    \`\`\`bash
    npm install express mercadopago dotenv nodemailer
    \`\`\`

2.  **Configure as Variáveis de Ambiente:**
    O arquivo `.env` já foi criado. Edite-o com suas credenciais.

    \`\`\`
    # Arquivo: .env
    MP_ACCESS_TOKEN=APP_USR-5242639548696429-120615-e4c4e9effc5513741b8f8c0af5abaf88-461780644

    # Credenciais do Nodemailer (Exemplo com Gmail)
    EMAIL_HOST=smtp.gmail.com
    EMAIL_PORT=587
    EMAIL_USER=migueloliveiraaleixosantos1@gmail.com
    EMAIL_PASS=xzoj pkbk eksy ytdi

    # Caminho para o arquivo PDF a ser enviado
    PDF_FILE_PATH=O_Caminho_Real_para_a_Sua_Renda_Online.pdf
    \`\`\`

3.  **Posicione o PDF:**
    Certifique-se de que o arquivo `O_Caminho_Real_para_a_Sua_Renda_Online.pdf` esteja na raiz do diretório do projeto.

4.  **Ajuste a URL de Notificação (Webhook):**
    No arquivo `index.js`, na rota `/create_preference`, você deve substituir o placeholder `SUA_URL_DE_DEPLOY_AQUI` pela URL base do seu backend após o deploy.

    \`\`\`javascript
    // Arquivo: index.js (aprox. linha 100)
    const notificationUrl = 'SUA_URL_DE_DEPLOY_AQUI/webhook';
    \`\`\`

## Como Rodar

Para iniciar o servidor localmente:

\`\`\`bash
node index.js
\`\`\`

O servidor será iniciado na porta `3000`.

## Endpoints

| Método | Rota | Descrição |
| :--- | :--- | :--- |
| `GET` | `/` | Rota de teste simples. |
| `POST` | `/create_preference` | Cria uma preferência de pagamento. **Requer `buyer_email` e `external_reference` no corpo da requisição.** |
| `POST` | `/webhook` | Recebe as notificações de status de pagamento do Mercado Pago e **envia o PDF por e-mail** se o status for `approved`. |
| `GET` | `/feedback/:status` | Rota de retorno após o pagamento (apenas para simulação). |

## Testando a Integração

1.  **Inicie o Servidor** (localmente ou após o deploy).
2.  **Crie a Preferência:** Envie uma requisição `POST` para `/create_preference`.
    *   **Exemplo de Requisição (POST) para `http://localhost:3000/create_preference`:**
        \`\`\`json
        {
            "buyer_email": "email_do_comprador@exemplo.com",
            "external_reference": "ORDER_1702556400000_abc123def"
        }
        \`\`\`
    *   **Resposta:** Você receberá um JSON contendo o `init_point` (URL de checkout).
3.  **Inicie o Pagamento:** Redirecione o usuário para o `init_point` recebido.
4.  **Simule o Webhook:**
    *   Após o pagamento ser aprovado, o Mercado Pago enviará uma notificação para a `notification_url`.
    *   A lógica no `index.js` buscará os detalhes do pagamento. Se o status for `approved`, ele tentará enviar o e-mail para o `buyer_email`.
    *   O `external_reference` será registrado nos logs, permitindo que você rastreie o pedido no seu sistema.

## O que é `external_reference`?

O `external_reference` é um identificador único que você cria para cada pedido no seu sistema. Ele permite que você:

1.  **Rastreie pedidos**: Vincule o pagamento do Mercado Pago com um pedido específico no seu banco de dados.
2.  **Atualize o status**: Use o `external_reference` para atualizar o status do pedido quando o webhook é recebido.
3.  **Mantenha histórico**: Registre todas as transações com seus IDs de pedido.

### Exemplo de Uso:

O frontend gera automaticamente um `external_reference` com o formato:
\`\`\`
ORDER_1702556400000_abc123def
\`\`\`

Quando o webhook é recebido, você pode usar este valor para:
\`\`\`javascript
// Exemplo de como usar o external_reference no seu banco de dados
const externalRef = resource.external_reference; // "ORDER_1702556400000_abc123def"
await updateOrderStatus(externalRef, 'approved'); // Atualizar o pedido no seu DB
\`\`\`

## Estrutura do Webhook

O endpoint `/webhook` está configurado para:

1.  Receber os parâmetros `topic` e `id` da URL.
2.  Verificar o `topic` (ex: `payment`).
3.  Usar o `id` para buscar os detalhes completos da transação na API do Mercado Pago.
4.  Extrair o `external_reference` do pagamento para rastrear o pedido.
5.  Enviar o PDF por e-mail se o status for `approved`.
6.  Responder com `HTTP 200 OK` imediatamente para evitar reenvios.

---
*Desenvolvido por Manus AI*
