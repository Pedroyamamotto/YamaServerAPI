import { getDb } from "../../db.js";
import { sendPasswordResetCode, sendPasswordResetConfirmation } from "../../../utils/EmailServices.js";
import bcrypt from "bcrypt";

export const requestPasswordReset = async (req, res) => {
    const { email } = req.body;

    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        const user = await usuariosCollection.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // Gerar código de redefinição
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

        await usuariosCollection.updateOne({ email }, { $set: { resetCode } });

        // Enviar e-mail com o código de redefinição (não bloqueia o fluxo se e-mail falhar)
        try {
            await sendPasswordResetCode(email, resetCode, user.nome || user.name);
            return res.status(200).json({ message: "E-mail de redefinição enviado com sucesso!" });
        } catch (emailError) {
            console.error("Falha ao enviar e-mail de redefinicao:", emailError.message);
            return res.status(200).json({
                message: "Codigo de redefinicao gerado com sucesso.",
                warning: "Nao foi possivel enviar e-mail neste ambiente.",
            });
        }
    } catch (error) {
        console.error("Erro ao solicitar redefinição de senha:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};

export const resetPassword = async (req, res) => {
    const { email, code, newPassword } = req.body;

    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        // Verifica se o usuário existe
        const user = await usuariosCollection.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        // Verifica se o código de redefinição é válido
        if (user.resetCode !== code) {
            return res.status(400).json({ error: "Código de redefinição inválido." });
        }

        // Atualiza a senha do usuário
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await usuariosCollection.updateOne(
            { email },
            { $set: { Senha: hashedPassword }, $unset: { resetCode: "" } }
        );

        // Enviar e-mail de confirmação (não bloqueia o fluxo se falhar)
        try {
            await sendPasswordResetConfirmation(email, user.nome || user.name);
        } catch (emailError) {
            console.error("Falha ao enviar e-mail de confirmação:", emailError.message);
        }

        return res.status(200).json({ message: "Senha redefinida com sucesso!" });
    } catch (error) {
        console.error("Erro ao redefinir senha:", error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
};