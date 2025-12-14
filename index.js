const express = require('express');
const cors = require('cors'); 
const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require("mercadopago");
const dotenv = require('dotenv');
const fs = require('fs'); 
const sgMail = require('@sendgrid/mail'); 

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

// Configuração do CORS (mantida)
const corsOptions = {
  origin: 'https://caminhodigital.vercel.app', 
  optionsSuccessStatus: 200 
}

// Configurar a API Key do SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY );

// Função para enviar o e-mail com o PDF (AGORA COM SENDGRID)
async function sendProductEmail(recipientEmail, pdfPath) {
    try {
        // Ler o arquivo PDF e converter para Base64
        const fileContent = fs.readFileSync(`./${pdfPath}`).toString('base64');

        const msg = {
            to: recipientEmail,
            from: 'migueloliveiraaleixosantos1@gmail.com', 
            subject: "Seu Produto Digital - O Caminho Real para a Sua Renda Online",
            html: `
                <p>Parabéns! Seu pagamento foi aprovado.</p>
                <p>Segue em anexo o seu produto digital.</p>
                <p>Obrigado por sua compra!</p>
            `,
            attachments: [
                {
                    content: fileContent,
                    filename: pdfPath,
                    type: 'application/pdf',
                    disposition: 'attachment',
                },
            ],
        };

        await sgMail.send(msg);
        console.log("E-mail enviado com sucesso via SendGrid!");
        return true;
    } catch (error) {
        console.error("Erro ao enviar e-mail via SendGrid:", error);
        if (error.response) {
            console.error(error.response.body)
        }
        return false;
    }
}

const app = express();
const port = 3000;

// Usar o middleware CORS (mantido)
app.use(cors(corsOptions)); 

// Middleware para processar JSON no corpo das requisições (mantido)
app.use(express.json());

// Configuração do Mercado Pago (mantida)
const client = new MercadoPagoConfig({ 
    accessToken: process.env.ACCESS_TOKEN,
    options: { timeout: 5000 }
});

const preferenceClient = new Preference(client);
const paymentClient = new Payment(client);
const merchantOrderClient = new MerchantOrder(client);


// Rota de teste (mantida)
app.get('/', (req, res) => {
    res.send('Servidor de Backend do Mercado Pago rodando!');
});

// Rota para criar a preferência de pagamento (mantida)
app.post('/create_preference', async (req, res) => {
    const { buyer_email, external_reference } = req.body;

    if (!buyer_email) {
        return res.status(400).send({ message: "O e-mail do comprador é obrigatório." });
    }

    if (!external_reference) {
        return res.status(400).send({ message: "O external_reference é obrigatório." });
    }

    const item = {
        title: "Produto de Teste",
        unit_price: 0.01,
        quantity: 1,
    };

    const notificationUrl = 'https://backend-plataforma-de-vendas.onrender.com/webhook';

    let preference = {
        items: [item],
        payer: {
            email: buyer_email,
        },
        back_urls: {
            success: "https://caminhodigital/feedback/success",
            failure: "https://caminhodigital/feedback/failure",
            pending: "https://caminhodigital/feedback/pending",
        },
        auto_return: "approved",
        notification_url: notificationUrl,
        external_reference: external_reference,
    };

    try {
        const response = await preferenceClient.create({ body: preference } );
        
        console.log(`Preferência criada com sucesso. External Reference: ${external_reference}`);
        res.status(200).json({
            id: response.id,
            init_point: response.init_point,
            sandbox_init_point: response.sandbox_init_point
        });
    } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Erro ao criar a preferência de pagamento", error: error.message });
    }
});

// Rota de feedback (mantida)
app.get('/feedback/:status', (req, res) => {
    res.send(`Status do Pagamento: ${req.params.status}. Detalhes da transação: ${JSON.stringify(req.query)}`);
});

// Rota para receber notificações de Webhook (mantida)
app.post('/webhook', async (req, res) => {
    const { topic, id } = req.query;

    if (!topic || !id) {
        return res.status(400).send('Requisição de Webhook inválida: topic ou id ausentes.');
    }

    console.log(`Webhook Recebido - Tópico: ${topic}, ID: ${id}`);

    try {
        let resource;

        if (topic === 'payment') {
            const payment = await paymentClient.get({ id: id });
            resource = payment;

            console.log(`--- Processando Pagamento ID: ${resource.id} ---`);
            console.log(`Status do Pagamento: ${resource.status}`);
            console.log(`Referência Externa (Seu ID de Pedido): ${resource.external_reference}`);

            if (resource.status === 'approved') {
                console.log("Pagamento Aprovado. Iniciando envio de e-mail...");
                console.log(`Pedido (external_reference): ${resource.external_reference}`);

                const recipientEmail = 'caminhodigital00@gmail.com';
                
                // >>>>> LOG DE DEBBUG AQUI <<<<<
                console.log(`[DEBUG] E-mail do Destinatário: ${recipientEmail}`);
                
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

            } else if (resource.status === 'pending') {
                console.log("Pagamento Pendente. Aguardando confirmação.");
            } else if (resource.status === 'rejected') {
                console.log("Pagamento Rejeitado.");
            }

        } else if (topic === 'merchant_order') {
            const order = await merchantOrderClient.get({ id: id });
            resource = order;

            console.log(`--- Processando Ordem de Compra ID: ${resource.id} ---`);
            console.log(`Status da Ordem: ${resource.status}`);

        } else {
            console.log(`Tópico de Webhook não suportado: ${topic}`);
        }

        res.status(200).send('OK');

    } catch (error) {
        console.error(`Erro ao processar webhook para Tópico: ${topic}, ID: ${id}`, error);
        res.status(500).send('Erro interno ao processar o webhook.');
    }
});

// Iniciar o servidor (mantida)
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}` );
});
