// server.js
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const path = require("path");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json()); // importante para o webhook receber JSON

// Configurar Nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER, // seu email
    pass: process.env.EMAIL_PASS, // senha ou app password
  },
});

// Rota de teste
app.get("/", (req, res) => res.send("Servidor rodando ✅"));

// Webhook do Mercado Pago
app.post("/webhook", async (req, res) => {
  try {
    // Mercado Pago envia o payment_id no query ou body
    const paymentId = req.query.id || req.body.id;
    const status = req.body.status || req.body.data?.status; // depende do tipo de webhook

    if (!paymentId) return res.status(400).send("No payment ID");

    console.log(`Pagamento recebido: ${paymentId} - status: ${status}`);

    // Se aprovado, envia o ebook
    if (status === "approved") {
      const email = req.body.payer?.email || req.body.data?.payer?.email;

      if (!email) {
        console.warn("Email do comprador não encontrado!");
      } else {
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
    }

    res.status(200).send("Webhook recebido ✅");
  } catch (err) {
    console.error("Erro no webhook:", err);
    res.status(500).send("Erro no webhook");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
