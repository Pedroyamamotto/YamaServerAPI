import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const smtpFrom = process.env.SMTP_FROM || "HLS API <noreply@yama.ia.br>";

const transporter =
  smtpHost && smtpUser && smtpPassword
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      })
    : null;

const isSmtpConfigured = () => {
  if (transporter) {
    return true;
  }

  console.error("SMTP não configurado: defina SMTP_HOST, SMTP_USER e SMTP_PASSWORD");
  return false;
};

async function sendMail({ to, subject, html }) {
  await transporter.sendMail({
    from: smtpFrom,
    to,
    subject,
    html,
  });
}

export const renderValidationEmailTemplate = (template, code) => {
  const renderedTemplate = template
    .replaceAll("{{validationCode}}", code)
    .replaceAll("{{code}}", code);

  if (renderedTemplate === template) {
    console.warn("Template de validação não continha placeholder conhecido para o código");
  }

  return renderedTemplate;
};

export async function sendValidationEmail(email, code) {
  if (!isSmtpConfigured()) {
    return;
  }

  try {
    // Caminho para o template HTML
    const templatePath = path.resolve("api/public/pages/codeVrifi.html");

    // Carregar o conteúdo do template
    const template = await fs.readFile(templatePath, "utf-8");

    // Substituir o placeholder pelo código de verificação
    const htmlContent = renderValidationEmailTemplate(template, code);

    // Enviar o e-mail
    await sendMail({
      to: email,
      subject: "Código de verificação",
      html: htmlContent,
    });

    console.log(`E-mail enviado com sucesso para ${email}`);
  } catch (error) {
    console.error("Erro ao enviar email:", error);
  }
}

export async function sendPasswordResetCode(email, codigo, nome) {
  if (!isSmtpConfigured()) {
    return;
  }

  try {
    const htmlContent = `
      <h2>Redefinição de Senha</h2>
      <p>Olá ${nome || "usuário"},</p>
      <p>Recebemos uma solicitação para redefinir sua senha. Use o código abaixo para continuar:</p>
      <h1 style="background: #f0f0f0; padding: 10px; text-align: center; font-size: 32px; letter-spacing: 5px;">${codigo}</h1>
      <p>Este código expire em 10 minutos.</p>
      <p>Se você não solicitou isso, ignore este e-mail.</p>
      <p>Atenciosamente,<br/>Equipe Yamamotto</p>
    `;

    await sendMail({
      to: email,
      subject: "Código de Redefinição de Senha",
      html: htmlContent,
    });

    console.log(`E-mail de redefinição enviado para ${email}`);
  } catch (error) {
    console.error("Erro ao enviar email de redefinição:", error);
  }
}

export async function sendPasswordResetConfirmation(email, nome) {
  if (!isSmtpConfigured()) {
    return;
  }

  try {
    const htmlContent = `
      <h2>Senha Redefinida com Sucesso</h2>
      <p>Olá ${nome || "usuário"},</p>
      <p>Sua senha foi redefinida com sucesso!</p>
      <p>Se você não solicitou essa alteração, entre em contato conosco imediatamente.</p>
      <p>Atenciosamente,<br/>Equipe ApiBling</p>
    `;

    await sendMail({
      to: email,
      subject: "Senha redefinida com sucesso",
      html: htmlContent,
    });

    console.log(`E-mail de confirmação de reset enviado para ${email}`);
  } catch (error) {
    console.error("Erro ao enviar email de confirmação:", error);
  }
}

export async function sendTecnicoAssignmentConfirmationEmail(email, details = {}) {
  if (!isSmtpConfigured()) {
    return;
  }

  const {
    assignedByName,
    tecnicoNome,
    dataInstalacao,
    horaInstalacao,
    localInstalacao,
    descricaoServico,
    clienteNome,
    numeroPedido,
    serviceId,
  } = details;

  try {
    const htmlContent = `
      <h2>Atribuicao realizada com sucesso</h2>
      <p>Ola ${assignedByName || "time Yamamotto"},</p>
      <p>A atribuicao do tecnico foi concluida e o compromisso foi enviado para a agenda.</p>
      <ul>
        <li><strong>Tecnico:</strong> ${tecnicoNome || "-"}</li>
        <li><strong>Data da instalacao:</strong> ${dataInstalacao || "-"}</li>
        <li><strong>Hora:</strong> ${horaInstalacao || "-"}</li>
        <li><strong>Local:</strong> ${localInstalacao || "-"}</li>
        <li><strong>O que sera instalado:</strong> ${descricaoServico || "-"}</li>
        <li><strong>Cliente:</strong> ${clienteNome || "-"}</li>
        <li><strong>Numero do pedido:</strong> ${numeroPedido || "-"}</li>
        <li><strong>ID do servico:</strong> ${serviceId || "-"}</li>
      </ul>
      <p>Atenciosamente,<br/>YamaService</p>
    `;

    await sendMail({
      to: email,
      subject: "Atribuicao confirmada e agenda atualizada",
      html: htmlContent,
    });

    console.log(`E-mail de confirmacao de atribuicao enviado para ${email}`);
  } catch (error) {
    console.error("Erro ao enviar email de confirmacao de atribuicao:", error);
  }
}

export default sendValidationEmail;