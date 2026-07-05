import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const getTecnicoDashboard = async (req, res) => {
    const { tecnicoId } = req.params;

    if (!ObjectId.isValid(tecnicoId)) {
        return res.status(400).json({ error: "ID de tecnico invalido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const tecnicoObjectId = new ObjectId(tecnicoId);

        // Contar serviços agendados (status: agendado, em_andamento)
        const agendados = await servicosCollection.countDocuments({
            tecnico_id: tecnicoObjectId.toString(),
            status: { $in: ["agendado", "em_andamento"] }
        });

        // Contar serviços concluídos
        const concluidos = await servicosCollection.countDocuments({
            tecnico_id: tecnicoObjectId.toString(),
            status: "concluido"
        });

        // Contar novos (status: novo)
        const novos = await servicosCollection.countDocuments({
            tecnico_id: tecnicoObjectId.toString(),
            status: "novo"
        });

        // Contar não realizados
        const naoRealizados = await servicosCollection.countDocuments({
            tecnico_id: tecnicoObjectId.toString(),
            status: "nao_realizado"
        });

        console.log(chalk.blue(`Sistema: Dashboard gerado para tecnico ${tecnicoId}`));

        return res.status(200).json({
            message: "Dashboard carregado com sucesso!",
            dashboard: {
                novos,
                agendados,
                concluidos,
                nao_realizados: naoRealizados,
                total: novos + agendados + concluidos + naoRealizados
            }
        });
    } catch (error) {
        console.error("Erro ao gerar dashboard do tecnico:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
