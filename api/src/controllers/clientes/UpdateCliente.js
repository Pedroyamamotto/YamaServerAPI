import yup from "yup";
import chalk from "../../chalk-stub.js";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";

function normalizeClientePayload(body) {
    const endereco = body.endereco || {};

    return {
        nome: body.nome || body.cliente,
        telefone: body.telefone,
        celular: body.celular,
        email: body.email,
        bling_pedido_id: body.bling_pedido_id,
        cpf: body.cpf,
        rua: body.rua || endereco.rua,
        numero: body.numero || endereco.numero,
        complemento: body.complemento || endereco.complemento,
        bairro: body.bairro || endereco.bairro,
        cidade: body.cidade || endereco.cidade,
        estado: body.estado || endereco.estado,
        cep: body.cep || endereco.cep,
    };
}

export const updateCliente = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID invalido" });
    }

    const clienteData = normalizeClientePayload(req.body);

    const schema = yup.object().shape({
        nome: yup.string(),
        telefone: yup.string(),
        celular: yup.string(),
        email: yup.string().nullable(),
        bling_pedido_id: yup.string().nullable(),
        cpf: yup.string(),
        rua: yup.string(),
        numero: yup.string(),
        complemento: yup.string(),
        bairro: yup.string(),
        cidade: yup.string(),
        estado: yup.string(),
        cep: yup.string(),
    });

    try {
        await schema.validate(clienteData, { abortEarly: false });
    } catch (error) {
        return res.status(400).json({ error: error.errors });
    }

    try {
        const db = await getDb();
        const clientesCollection = db.collection("clientes");

        const existingCliente = await clientesCollection.findOne({ _id: new ObjectId(id) });
        if (!existingCliente) {
            return res.status(404).json({ error: "Cliente nao encontrado" });
        }

        if (clienteData.cpf && clienteData.cpf !== existingCliente.cpf) {
            const duplicateCliente = await clientesCollection.findOne({ cpf: clienteData.cpf });
            if (duplicateCliente) {
                return res.status(400).json({ error: "Ja existe outro cliente com este CPF" });
            }
        }

        const updateData = Object.fromEntries(
            Object.entries(clienteData).filter(([, value]) => value !== undefined)
        );

        if (
            updateData.rua !== undefined ||
            updateData.numero !== undefined ||
            updateData.bairro !== undefined ||
            updateData.cidade !== undefined ||
            updateData.estado !== undefined ||
            updateData.cep !== undefined ||
            updateData.complemento !== undefined
        ) {
            updateData.endereco = {
                rua: updateData.rua ?? existingCliente.endereco?.rua ?? existingCliente.rua ?? null,
                numero: updateData.numero ?? existingCliente.endereco?.numero ?? existingCliente.numero ?? null,
                bairro: updateData.bairro ?? existingCliente.endereco?.bairro ?? existingCliente.bairro ?? null,
                cidade: updateData.cidade ?? existingCliente.endereco?.cidade ?? existingCliente.cidade ?? null,
                estado: updateData.estado ?? existingCliente.endereco?.estado ?? existingCliente.estado ?? null,
                cep: updateData.cep ?? existingCliente.endereco?.cep ?? existingCliente.cep ?? null,
                complemento: updateData.complemento ?? existingCliente.endereco?.complemento ?? existingCliente.complemento ?? null,
            };
        }

        const result = await clientesCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: updateData }
        );

        console.log(chalk.yellow(`Sistema: Cliente atualizado com sucesso: ${id}`));

        return res.status(200).json({
            message: "Cliente atualizado com sucesso!",
            modifiedCount: result.modifiedCount,
        });
    } catch (error) {
        console.error("Erro ao atualizar cliente:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
