import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

export const getTecnicos = async (req, res) => {
    try {
        const db = await getDb();
        const usuariosCollection = db.collection("usuários");

        const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
        const skip = (page - 1) * limit;
        const filter = { typeUser: "tecnico" };

        const total = await usuariosCollection.countDocuments(filter);

        const tecnicos = await usuariosCollection
            .find(filter)
            .project({
                Senha: 0,
                password: 0,
                validationCode: 0,
            })
            .sort({ Created_et: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();

        const formattedTecnicos = tecnicos.map((tecnico) => ({
            ...tecnico,
            id: tecnico._id?.toString(),
        }));

        console.log(chalk.blue(`Sistema 💻 : ${formattedTecnicos.length} técnico(s) encontrado(s) 🔍`));

        return res.status(200).json({
            message: "Técnicos listados com sucesso!",
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            count: formattedTecnicos.length,
            tecnicos: formattedTecnicos,
        });
    } catch (error) {
        console.error("Erro ao buscar técnicos:", error);
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};
