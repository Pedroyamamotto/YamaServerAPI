import yup from "yup";
import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

export const finalizeService = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID invalido" });
    }

    const schema = yup.object().shape({
        checklist: yup
            .object({
                instalacao_concluida: yup.boolean().required(),
                cadastro_senhas: yup.boolean().required(),
                teste_abertura: yup.boolean().required(),
                verificacao_bateria: yup.boolean().required(),
                teste_travamento: yup.boolean().required(),
                orientacao_cliente: yup.boolean().required(),
                sincronizacao_app: yup.boolean().required(),
                entrega_cartoes: yup.boolean().required(),
            })
            .required(),
        fotos: yup.array().of(yup.string().url().required()).min(1).required(),
        assinatura: yup
            .object({
                nome_cliente: yup.string().required(),
                assinatura_url: yup.string().url().required(),
            })
            .required(),
        checkin_data: yup.date(),
        observacoes: yup.string(),
    });

    try {
        await schema.validate(req.body, { abortEarly: false });
    } catch (error) {
        return res.status(400).json({ error: error.errors });
    }

    const { checklist, fotos, assinatura, checkin_data, observacoes } = req.body;

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const checklistCollection = db.collection("servicos_checklist");
        const fotosCollection = db.collection("servico_fotos");
        const assinaturaCollection = db.collection("servico_assinatura");

        const servicoId = new ObjectId(id);

        const existingService = await servicosCollection.findOne({ _id: servicoId });
        if (!existingService) {
            return res.status(404).json({ error: "Servico nao encontrado" });
        }

        await checklistCollection.updateOne(
            { servico_id: servicoId },
            {
                $set: {
                    servico_id: servicoId,
                    ...checklist,
                    created_at: new Date(),
                },
            },
            { upsert: true }
        );

        await fotosCollection.deleteMany({ servico_id: servicoId });
        await fotosCollection.insertMany(
            fotos.map((url_foto) => ({
                servico_id: servicoId,
                url_foto,
                created_at: new Date(),
            }))
        );

        await assinaturaCollection.updateOne(
            { servico_id: servicoId },
            {
                $set: {
                    servico_id: servicoId,
                    nome_cliente: assinatura.nome_cliente,
                    assinatura_url: assinatura.assinatura_url,
                    created_at: new Date(),
                },
            },
            { upsert: true }
        );

        const updateServiceData = {
            status: "concluido",
            concluido_em: new Date(),
            updated_at: new Date(),
        };

        if (checkin_data) {
            updateServiceData.checkin_data = new Date(checkin_data);
        }

        if (observacoes) {
            updateServiceData.observacoes = observacoes;
        }

        await servicosCollection.updateOne(
            { _id: servicoId },
            { $set: updateServiceData }
        );

        console.log(chalk.green(`Sistema: Servico finalizado com sucesso: ${id}`));

        return res.status(200).json({
            message: "Servico finalizado com sucesso!",
            serviceId: id,
        });
    } catch (error) {
        console.error("Erro ao finalizar servico:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
