import fs from "fs/promises";
import path from "path";
import nodemailer from "nodemailer";

function cleanEnv(rawValue) {
  const value = String(rawValue || "").trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function getMissingSmtpVars() {
  const missing = [];
  if (!cleanEnv(process.env.SMTP_HOST)) missing.push("SMTP_HOST");
  if (cleanEnv(process.env.SMTP_USER) && !cleanEnv(process.env.SMTP_PASSWORD)) missing.push("SMTP_PASSWORD");
  if (!cleanEnv(process.env.SMTP_USER) && cleanEnv(process.env.SMTP_PASSWORD)) missing.push("SMTP_USER");
  return missing;
}

function ensureSmtpReady(contexto) {
  const missing = getMissingSmtpVars();
  if (missing.length === 0) return true;

  const details = `Configuracao SMTP incompleta (${missing.join(", ")}) durante ${contexto}.`;
  if (process.env.NODE_ENV === "production") {
    throw new Error(details);
  }

  console.warn(`${details} Envio de e-mail desativado neste ambiente.`);
  return false;
}

const smtpHost = cleanEnv(process.env.SMTP_HOST);
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
const smtpUser = cleanEnv(process.env.SMTP_USER);
let smtpPassword = cleanEnv(process.env.SMTP_PASSWORD);
const smtpFrom = cleanEnv(process.env.SMTP_FROM) || smtpUser || "noreply@yama.ia.br";

if (/gmail\.com$/i.test(smtpHost)) {
  smtpPassword = smtpPassword.replace(/\s+/g, "");
}

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  auth: smtpUser
    ? {
        user: smtpUser,
        pass: smtpPassword,
      }
    : undefined,
});

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
  if (!ensureSmtpReady("sendValidationEmail")) {
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
  if (!ensureSmtpReady("sendPasswordResetCode")) {
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
  if (!ensureSmtpReady("sendPasswordResetConfirmation")) {
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
  if (!ensureSmtpReady("sendTecnicoAssignmentConfirmationEmail")) {
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