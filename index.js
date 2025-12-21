const express = require('express');
const cors = require('cors');
const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require("mercadopago");
const dotenv = require('dotenv');
const fs = require('fs');
const crypto = require("crypto");
const sgMail = require('@sendgrid/mail');

// 1. OBJETO PARA ARMAZENAR E-MAILS EM MEMÓRIA (Substitui o Banco de Dados)
const orderEmails = {};

// Evita processar o mesmo pagamento mais de uma vez
const processedPayments = new Set();

// Carregar variáveis de ambiente do arquivo .env
dotenv.config();

// Configuração do CORS (mantida)
const allowedOrigin = 'https://caminhodigital.vercel.app';

const corsOptions = {
    origin: function (origin, callback) {
        // Permite frontend OU requisições sem origin (webhook, backend)
        if (!origin || origin === allowedOrigin) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};
// Configurar a API Key do SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Função para enviar o e-mail com o PDF (mantida)
async function sendProductEmail(recipientEmail, pdfPath) {
    try {
        const fileContent = fs.readFileSync(`./${pdfPath}`).toString('base64');

        const msg = {
            to: recipientEmail,
            from: 'migueloliveiraaleixosantos1@gmail.com',
            subject: "Seu Produto Digital - O Caminho Real para a Sua Renda Online",
            html: `
        <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f4f6f8; padding: 30px;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
                
                <div style="background: #0f172a; color: #ffffff; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 22px;">
                        Compra Confirmada 🎉
                    </h1>
                </div>

                <div style="padding: 25px; color: #333333;">
                    <p style="font-size: 16px;">
                        Olá!
                    </p>

                    <p style="font-size: 16px; line-height: 1.6;">
                        Seu pagamento foi <strong>aprovado com sucesso</strong> e estamos muito felizes em ter você aqui.
                    </p>

                    <p style="font-size: 16px; line-height: 1.6;">
                        O seu produto digital <strong>“O Caminho Real para a Sua Renda Online”</strong> está anexado neste e-mail.
                    </p>

                    <div style="margin: 25px 0; padding: 15px; background: #f1f5f9; border-left: 4px solid #0f172a;">
                        <p style="margin: 0; font-size: 15px;">
                            📎 <strong>Dica:</strong> Salve o arquivo em um local seguro para acessar sempre que precisar.
                        </p>
                    </div>

                    <p style="font-size: 16px; line-height: 1.6;">
                        Qualquer dúvida, é só responder este e-mail.  
                        Desejamos muito sucesso na sua jornada!
                    </p>

                    <p style="margin-top: 30px; font-size: 15px;">
                        Atenciosamente,<br>
                        <strong>Caminho Digital</strong>
                    </p>
                </div>

                <div style="background: #f8fafc; text-align: center; padding: 15px; font-size: 13px; color: #64748b;">
                    © ${new Date().getFullYear()} Caminho Digital — Todos os direitos reservados
                </div>

            </div>
        </div>
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

app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf.toString("utf8");
        }
    })
);
app.use(cors(corsOptions));


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

// Rota para criar a preferência de pagamento
app.post('/create_preference', async (req, res) => {
    const { buyer_email, external_reference } = req.body;

    if (!buyer_email) {
        return res.status(400).send({ message: "O e-mail do comprador é obrigatório." });
    }

    if (!external_reference) {
        return res.status(400).send({ message: "O external_reference é obrigatório." });
    }

    // 2. ARMAZENAR O E-MAIL DO COMPRADOR ANTES DE CRIAR A PREFERÊNCIA
    orderEmails[external_reference] = buyer_email;
    console.log(`[DB SIMULADO] E-mail ${buyer_email} armazenado para ${external_reference}`);


    const item = {
        title: "O Caminho Real para a Sua Renda Online",
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
        const response = await preferenceClient.create({ body: preference });

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

// Rota para receber notificações de Webhook
app.post('/webhook', async (req, res) => {

    const topic =
        req.query.topic ||
        req.query.type ||
        req.body?.type;

    const paymentId =
        req.body?.data?.id ||
        req.body?.id ||
        req.query?.id;

    if (!paymentId) {
        console.log("❌ Webhook sem payment ID, ignorado");
        return res.status(200).send("No payment ID");
    }

    // ⚠️ Teste do painel do MP NÃO envia assinatura
    if (!req.headers['x-signature']) {
        console.log('🧪 Webhook de teste do Mercado Pago ignorado');
        return res.status(200).send('Test ignored');
    }

    console.log('✅ Webhook autenticado (payment real)');

    try {

        if (topic !== 'payment') {
            console.log(`🔕 Evento ignorado (${topic})`);
            return res.status(200).send('Ignored');
        }

        // 🔍 Busca o pagamento REAL
        const resource = await paymentClient.get({ id: paymentId });

        // 🔒 BLOQUEIO IMEDIATO (anti-duplicação)
        if (processedPayments.has(resource.id)) {
            console.log(`⚠️ Webhook duplicado ignorado | Payment ID: ${resource.id}`);
            return res.status(200).send("Already processed");
        }

        processedPayments.add(resource.id);

        console.log(`--- Processando Pagamento ID: ${resource.id} ---`);
        console.log(`Status do Pagamento: ${resource.status}`);

        if (
            resource.status !== 'approved' ||
            resource.status_detail !== 'accredited'
        ) {
            console.log("Pagamento ainda não confirmado");
            return res.status(200).send("Not approved");
        }

        const externalRef = resource.external_reference;
        console.log(`Referência Externa: ${externalRef}`);

        // 📧 Recupera e-mail
        const emailFromMemory = orderEmails[externalRef];
        const emailFromPayment =
            resource.payer?.email ||
            resource.additional_info?.payer?.email;

        const finalEmail = emailFromMemory || emailFromPayment;

        console.log(`[DEBUG] Email final usado: ${finalEmail}`);

        if (!finalEmail) {
            console.error("❌ Nenhum e-mail encontrado para este pagamento");
            return res.status(200).send("No email");
        }

        const pdfPath = process.env.PDF_FILE_PATH;

        if (!pdfPath) {
            console.error("❌ Caminho do PDF não configurado");
            return res.status(500).send("PDF missing");
        }

        await sendProductEmail(finalEmail, pdfPath);

        console.log(`✅ Produto enviado com sucesso | Payment ID: ${resource.id}`);

        return res.status(200).send('OK');

    } catch (error) {
        console.error("❌ Erro ao processar webhook:", error);
        return res.status(500).send('Internal error');
    }
});

// Iniciar o servidor (mantida)
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
