import yup from "yup";
import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

export const createPedido = async (req, res) => {
    const schema = yup.object().shape({
        bling_pv_id: yup.string().required(),
        cliente_id: yup.string().required(),
        modelo_produto: yup.string().required(),
        tipo_servico: yup.string().required(),
        tem_instalacao: yup.boolean().required(),
        data_agendamento: yup.date(),
        observacoes: yup.string(),
    });

    try {
        await schema.validate(req.body, { abortEarly: false });
    } catch (error) {
        return res.status(400).json({ error: error.errors });
    }

    const {
        bling_pv_id,
        cliente_id,
        modelo_produto,
        tipo_servico,
        tem_instalacao,
        data_agendamento,
        observacoes,
    } = req.body;

    try {
        const db = await getDb();
        const pedidosCollection = db.collection("pedidos");

        // Verificar se já existe pedido com o mesmo bling_pv_id
        const existingPedido = await pedidosCollection.findOne({ bling_pv_id });
        if (existingPedido) {
            return res.status(400).json({ error: "Pedido com este bling_pv_id já cadastrado." });
        }

        const result = await pedidosCollection.insertOne({
            bling_pv_id,
            cliente_id,
            modelo_produto,
            tipo_servico,
            tem_instalacao,
            data_agendamento: data_agendamento ? new Date(data_agendamento) : null,
            observacoes: observacoes || null,
            created_at: new Date(),
        });

        console.log(chalk.green(`Sistema 💻 : Pedido Cadastrado com Sucesso: ${result.insertedId} ✅`));

        return res.status(201).json({
            message: "Pedido criado com sucesso!",
            pedidoId: result.insertedId,
        });
    } catch (error) {
        console.error("Erro ao criar pedido:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
