import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const getServiceFinalizacao = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID invalido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const checklistCollection = db.collection("servicos_checklist");
        const fotosCollection = db.collection("servico_fotos");
        const assinaturaCollection = db.collection("servico_assinatura");

        const servicoId = new ObjectId(id);

        const servico = await servicosCollection.findOne({ _id: servicoId });
        if (!servico) {
            return res.status(404).json({ error: "Servico nao encontrado" });
        }

        const checklist = await checklistCollection.findOne({ servico_id: servicoId });
        const fotos = await fotosCollection.find({ servico_id: servicoId }).toArray();
        const assinatura = await assinaturaCollection.findOne({ servico_id: servicoId });

        console.log(chalk.blue(`Sistema: Finalizacao consultada para servico ${id}`));

        return res.status(200).json({
            message: "Finalizacao carregada com sucesso!",
            servico,
            checklist,
            fotos,
            assinatura,
        });
    } catch (error) {
        console.error("Erro ao consultar finalizacao do servico:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
