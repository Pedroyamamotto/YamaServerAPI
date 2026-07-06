import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

export const getGerentes = async (req, res) => {
    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        // Buscar todos os usuários do tipo gerente
        const gerentes = await usuariosCollection
            .find({ typeUser: "gerente" })
            .project({
                Senha: 0,
                password: 0,
                validationCode: 0,
            })
            .toArray();

        // Para cada gerente, contar quantos técnicos têm seu ID como gerente_id
        const formattedGerentes = await Promise.all(
            gerentes.map(async (gerente) => {
                const gerenteIdStr = gerente._id.toString();
                const count = await usuariosCollection.countDocuments({
                    typeUser: "tecnico",
                    $or: [
                        { gerente_id: gerenteIdStr },
                        { gerenteId: gerenteIdStr }
                    ]
                });

                return {
                    id: gerenteIdStr,
                    nome: gerente.nome || gerente.name || "Gerente",
                    email: gerente.email || "",
                    telefone: gerente.telefone || gerente.phone || "",
                    tecnicosVinculados: count,
                    lastLocation: gerente.lastLocation || null,
                };
            })
        );

        console.log(chalk.blue(`Sistema 💻 : ${formattedGerentes.length} gerente(s) encontrado(s) 🔍`));

        return res.status(200).json({
            message: "Gerentes listados com sucesso!",
            gerentes: formattedGerentes,
        });
    } catch (error) {
        console.error("Erro ao buscar gerentes:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
