import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

export const getServices = async (req, res) => {
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");

        // Filtros opcionais via query params
        const { status, tecnico_id, cliente_id, pedido_id } = req.query;

        const filter = {};
        if (status) filter.status = status;
        if (tecnico_id) filter.tecnico_id = tecnico_id;
        if (cliente_id) filter.cliente_id = cliente_id;
        if (pedido_id) filter.pedido_id = pedido_id;

        const services = await servicosCollection.find(filter).toArray();
        const servicesFormatted = services.map((service) => ({
            ...service,
            id: service._id?.toString(),
            numero_pedido: service.numero_pedido ?? null,
        }));

        console.log(chalk.blue(`Sistema 💻 : ${servicesFormatted.length} serviço(s) encontrado(s) 🔍`));

        return res.status(200).json({
            message: "Serviços listados com sucesso!",
            count: servicesFormatted.length,
            services: servicesFormatted,
        });
    } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
