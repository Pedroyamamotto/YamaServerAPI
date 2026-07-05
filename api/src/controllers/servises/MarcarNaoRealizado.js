import yup from "yup";
import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const marcarNaoRealizado = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID invalido" });
    }

    const schema = yup.object().shape({
        nao_realizado_motivo: yup.string().required("Motivo e obrigatorio"),
        observacoes: yup.string()
    });

    try {
        await schema.validate(req.body, { abortEarly: false });
    } catch (error) {
        return res.status(400).json({ error: error.errors });
    }

    const { nao_realizado_motivo, observacoes } = req.body;

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        const servicoId = new ObjectId(id);

        const existingService = await servicosCollection.findOne({ _id: servicoId });
        if (!existingService) {
            return res.status(404).json({ error: "Servico nao encontrado" });
        }

        const updateData = {
            status: "nao_realizado",
            nao_realizado_motivo,
            updated_at: new Date()
        };

        if (observacoes) {
            updateData.observacoes = observacoes;
        }

        await servicosCollection.updateOne(
            { _id: servicoId },
            { $set: updateData }
        );

        console.log(chalk.red(`Sistema: Servico marcado como nao realizado: ${id}`));

        return res.status(200).json({
            message: "Servico marcado como nao realizado",
            serviceId: id
        });
    } catch (error) {
        console.error("Erro ao marcar servico como nao realizado:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
