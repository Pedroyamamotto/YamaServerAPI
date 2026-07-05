import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";

export const getClientes = async (req, res) => {
    try {
        const db = await getDb();
        const clientesCollection = db.collection("clientes");

        const { nome, cpf, cidade, estado, telefone } = req.query;

        const filter = {};
        if (nome) filter.nome = nome;
        if (cpf) filter.cpf = cpf;
        if (cidade) filter.cidade = cidade;
        if (estado) filter.estado = estado;
        if (telefone) filter.telefone = telefone;

        const clientes = await clientesCollection.find(filter).toArray();

        console.log(chalk.blue(`Sistema: ${clientes.length} cliente(s) encontrado(s)`));

        return res.status(200).json({
            message: "Clientes listados com sucesso!",
            count: clientes.length,
            clientes,
        });
    } catch (error) {
        console.error("Erro ao buscar clientes:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
