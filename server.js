const express = require("express");
const mercadopago = require("mercadopago");
const dotenv = require("dotenv");
const nodemailer = require("nodemailer");
const path = require("path");

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mercadopago.configurations = {
  access_token: process.env.MP_ACCESS_TOKEN
};

// Configura Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Rota de teste
app.get("/", (req, res) => {
  res.send("Servidor funcionando ✅");
});

// Criar preferência de pagamento
app.post("/checkout", async (req, res) => {
  try {
    const { nome, email } = req.body;

    const preference = {
      items: [
        {
          title: "Ebook Definitivo",
          unit_price: 0.01,
          quantity: 1,
        },
      ],
      payer: {
        name: nome,
        email: email,
      },
      back_urls: {
        success: "https://caminhodigital.vercel.app/sucesso",
        failure: "https://caminhodigital.vercel.app/erro",
        pending: "https://caminhodigital.vercel.app/pendente",
      },
      auto_return: "approved",
    };

    const response = await mercadopago.preferences.create(preference);
    res.json({ id: response.body.id, init_point: response.body.init_point });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar preferência" });
  }
});

// Webhook para pagamento aprovado
app.post("/webhook", async (req, res) => {
  try {
    const paymentId = req.query.id || req.body.id;
    if (!paymentId) return res.status(400).send("No payment ID");

    const payment = await mercadopago.payment.get(paymentId);

    if (payment.body.status === "approved") {
      const email = payment.body.payer.email;

      // Envia o ebook por email
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Seu Ebook Definitivo",
        text: "Obrigado pela compra! Segue seu ebook em anexo.",
        attachments: [
          {
            filename: "Ebook.pdf",
            path: path.join(__dirname, "ebook.pdf"),
          },
        ],
      });

      console.log(`Ebook enviado para ${email}`);
    }

    res.status(200).send("Webhook recebido ✅");
  } catch (err) {
    console.error(err);
    res.status(500).send("Erro no webhook");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
