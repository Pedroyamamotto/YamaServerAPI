import { getDb } from "../../db.js";
import yup from "yup";
import chalk from "../../chalk-stub.js";
import bcrypt from "bcrypt";

// Validação do schema de login
const loginSchema = yup.object().shape({
    email: yup.string().email().required(),
    password: yup.string(),
    Senha: yup.string(),
});

// Rota de login
export async function loginUser(req, res) {
    const { email, isVerified } = req.body;
    const rawPassword = req.body.password || req.body.Senha;
    const db = await getDb();
    const usuariosCollection = db.collection("usuários");

    try {
        // Valida os dados recebidos
        await loginSchema.validate({ email, password: rawPassword, isVerified });

        // Busca o usuário pelo email
        const user = await usuariosCollection.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        // Verifica se o usuário está validado
        if (user.email_ver === false) {
            return res.status(403).json({ message: "Conta não verificada. Verifique seu e-mail." });
        }

        // Compara a senha fornecida com a senha armazenada
        const storedHash = user.Senha || user.password;
        const isPasswordValid = await bcrypt.compare(rawPassword, storedHash);
        if (!isPasswordValid) {
            return res.status(401).json({ message: "Credenciais inválidas" });
        }

        console.log(chalk.green(`Sistema 💻 : Login bem-sucedido: ${user._id}`));

        return res.status(200).json({
            message: "Login bem-sucedido ✅",
            userId: user._id,
            typeUser: user.typeUser,
            name: user.nome || user.name || "Nome não disponível",
        });
    } catch (error) {
        console.log(chalk.red(`Sistema 💻 : Erro ao fazer login: ${error.message} ❌`));
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
}