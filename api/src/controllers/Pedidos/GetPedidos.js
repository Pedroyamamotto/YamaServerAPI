import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

export const getPedidos = async (req, res) => {
    try {
        const db = await getDb();
        const pedidosCollection = db.collection("pedidos");

        // Filtros opcionais via query params
        const { cliente_id, tipo_servico, tem_instalacao, bling_pv_id } = req.query;

        const filter = {};
        if (cliente_id) filter.cliente_id = cliente_id;
        if (tipo_servico) filter.tipo_servico = tipo_servico;
        if (tem_instalacao !== undefined) filter.tem_instalacao = tem_instalacao === 'true';
        if (bling_pv_id) filter.bling_pv_id = bling_pv_id;

        const pedidos = await pedidosCollection.find(filter).toArray();

        console.log(chalk.blue(`Sistema 💻 : ${pedidos.length} pedido(s) encontrado(s) 🔍`));

        return res.status(200).json({
            message: "Pedidos listados com sucesso!",
            count: pedidos.length,
            pedidos,
        });
    } catch (error) {
        console.error("Erro ao buscar pedidos:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
