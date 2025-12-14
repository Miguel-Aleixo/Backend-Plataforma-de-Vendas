const express = require('express');
// 1. Importações corrigidas: MercadoPagoConfig para o cliente e as classes de API (Preference, Payment, MerchantOrder)
const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require("mercadopago");
const dotenv = require('dotenv');
const nodemailer = require('nodemailer'); // Importar Nodemailer

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

// Configuração do Nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT == 465, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// Função para enviar o e-mail com o PDF
async function sendProductEmail(recipientEmail, pdfPath) {
    try {
        const info = await transporter.sendMail({
            from: `"Sua Loja" <${process.env.EMAIL_USER}>`, // Endereço do remetente
            to: recipientEmail, // Lista de destinatários
            subject: "Seu Produto Digital - O Caminho Real para a Sua Renda Online", // Assunto
            html: `
                <p>Parabéns! Seu pagamento foi aprovado.</p>
                <p>Segue em anexo o seu produto digital.</p>
                <p>Obrigado por sua compra!</p>
            `, // Corpo do e-mail em HTML
            attachments: [
                {
                    filename: pdfPath,
                    path: `./${pdfPath}`, // Caminho do arquivo no servidor
                    contentType: 'application/pdf'
                }
            ]
        });

        console.log("E-mail enviado: %s", info.messageId);
        return true;
    } catch (error) {
        console.error("Erro ao enviar e-mail:", error);
        return false;
    }
}

const app = express();
const port = 3000;

// Middleware para processar JSON no corpo das requisições
app.use(express.json());

// 2. Configurar as credenciais do Mercado Pago com a nova classe MercadoPagoConfig
const client = new MercadoPagoConfig({ 
    accessToken: process.env.ACCESS_TOKEN,
    options: { timeout: 5000 }
});

// Inicializar os clientes de API que serão usados nas rotas
const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);
const merchantOrderClient = new MerchantOrder(client);


// Rota de teste
app.get('/', (req, res) => {
    res.send('Servidor de Backend do Mercado Pago rodando!');
});

// Rota para criar a preferência de pagamento
app.post('/create_preference', async (req, res) => {
    // O ideal é que os dados do item, e-mail do comprador e external_reference venham do corpo da requisição (req.body)
    const { buyer_email, external_reference } = req.body;

    if (!buyer_email) {
        return res.status(400).send({ message: "O e-mail do comprador é obrigatório." });
    }

    if (!external_reference) {
        return res.status(400).send({ message: "O external_reference é obrigatório." });
    }

    // Para este exemplo, usaremos um item fixo.
    const item = {
        title: "Produto de Teste",
        unit_price: 0.01,
        quantity: 1,
    };

    // URL de notificação (Webhook)
    // ATENÇÃO: Substitua 'SUA_URL_DE_DEPLOY_AQUI' pela URL base do seu backend DEPLOYADO.
    const notificationUrl = 'https://backend-plataforma-de-vendas.onrender.com/webhook';

    let preference = {
        items: [item],
        payer: {
            email: buyer_email, // O e-mail do comprador é essencial para o envio do PDF
        },
        back_urls: {
            success: "https://caminhodigital/feedback/success", // URLs de retorno após o pagamento
            failure: "https://caminhodigital/feedback/failure",
            pending: "https://caminhodigital/feedback/pending",
        },
        auto_return: "approved",
        notification_url: notificationUrl,
        external_reference: external_reference, // ID único para rastrear o pedido no seu sistema (recebido do frontend )
    };

    try {
        // 3. Alteração: Usar preferenceClient.create e passar o objeto preference dentro de { body: ... }
        const response = await preferenceClient.create({ body: preference });
        
        console.log(`Preferência criada com sucesso. External Reference: ${external_reference}`);
        res.status(200).json({
            // 4. Alteração: O novo SDK retorna o objeto diretamente, sem a propriedade .body
            id: response.id,
            init_point: response.init_point, // URL para redirecionar o usuário
            sandbox_init_point: response.sandbox_init_point // URL para redirecionar em ambiente de sandbox
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Erro ao criar a preferência de pagamento", error: error.message });
    }
});

// Rota de feedback (apenas para simulação de retorno)
app.get('/feedback/:status', (req, res) => {
    res.send(`Status do Pagamento: ${req.params.status}. Detalhes da transação: ${JSON.stringify(req.query)}`);
});

// Rota para receber notificações de Webhook
app.post('/webhook', async (req, res) => {
    // O Mercado Pago envia o ID da notificação via query params
    const { topic, id } = req.query;

    if (!topic || !id) {
        return res.status(400).send('Requisição de Webhook inválida: topic ou id ausentes.');
    }

    console.log(`Webhook Recebido - Tópico: ${topic}, ID: ${id}`);

    try {
        let resource;

        // O Mercado Pago envia diferentes tópicos (payment, merchant_order, etc.)
        if (topic === 'payment') {
            // 5. Alteração: Usar paymentClient.get({ id: id })
            const payment = await paymentClient.get({ id: id });
            resource = payment; // O novo SDK retorna o objeto diretamente

            // Lógica principal: Atualizar o status do pedido no seu sistema
            console.log(`--- Processando Pagamento ID: ${resource.id} ---`);
            console.log(`Status do Pagamento: ${resource.status}`);
            console.log(`Referência Externa (Seu ID de Pedido): ${resource.external_reference}`);

            if (resource.status === 'approved') {
                console.log("Pagamento Aprovado. Iniciando envio de e-mail...");
                console.log(`Pedido (external_reference): ${resource.external_reference}`);

                const recipientEmail = resource.payer.email;
                const pdfPath = process.env.PDF_FILE_PATH;
                const externalRef = resource.external_reference;

                if (recipientEmail && pdfPath) {
                    const emailSent = await sendProductEmail(recipientEmail, pdfPath);
                    if (emailSent) {
                        console.log(`✓ E-mail enviado com sucesso para ${recipientEmail} (Pedido: ${externalRef})`);
                    }
                } else {
                    console.error("Não foi possível enviar o e-mail: E-mail do comprador ou caminho do PDF ausente.");
                }

                // **ATENÇÃO:** Aqui você deve adicionar a lógica para atualizar o status do pedido no seu banco de dados
                // Exemplo:
                // await updateOrderStatus(externalRef, 'approved');
                // Isso permitirá que você rastreie o pedido usando o external_reference

            } else if (resource.status === 'pending') {
                // Atualizar pedido para "Pendente"
                console.log("Pagamento Pendente. Aguardando confirmação.");
            } else if (resource.status === 'rejected') {
                // Atualizar pedido para "Rejeitado"
                console.log("Pagamento Rejeitado.");
            }

        } else if (topic === 'merchant_order') {
            // 6. Alteração: Usar merchantOrderClient.get({ id: id })
            const order = await merchantOrderClient.get({ id: id });
            resource = order; // O novo SDK retorna o objeto diretamente

            console.log(`--- Processando Ordem de Compra ID: ${resource.id} ---`);
            console.log(`Status da Ordem: ${resource.status}`);

        } else {
            console.log(`Tópico de Webhook não suportado: ${topic}`);
        }

        // É crucial responder com 200 OK para o Mercado Pago, mesmo que o tópico não seja processado
        res.status(200).send('OK');

    } catch (error) {
        console.error(`Erro ao processar webhook para Tópico: ${topic}, ID: ${id}`, error);
        // Em caso de erro, o Mercado Pago tentará reenviar a notificação.
        res.status(500).send('Erro interno ao processar o webhook.');
    }
});

// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}` );
});
