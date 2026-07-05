import chalk from "../../chalk-stub.js";
import { getDb } from "../../db.js";
import mongodb from "mongodb";
const { ObjectId } = mongodb;

const normalizePhotoUrls = (service) => {
    if (Array.isArray(service?.fotos_urls) && service.fotos_urls.length > 0) {
        return service.fotos_urls.filter(Boolean);
    }

    if (service?.foto_url) {
        return [service.foto_url];
    }

    return [];
};

const normalizeContextPhotos = (service) => {
    const context = service?.fotos_contexto || {};

    const portaCliente = Array.isArray(context.porta_cliente) ? context.porta_cliente.filter(Boolean) : [];
    const instalacoes = Array.isArray(context.instalacoes) ? context.instalacoes.filter(Boolean) : [];

    return {
        porta_cliente: portaCliente,
        instalacoes: instalacoes,
    };
};

export const getServiceById = async (req, res) => {
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ error: "ID inválido" });
    }

    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const usuariosCollection = db.collection("usuários");

        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });

        if (!service) {
            return res.status(404).json({ error: "Serviço não encontrado" });
        }

        let tecnicoNome = null;
        if (service.tecnico_id) {
            try {
                const tecUser = await usuariosCollection.findOne({ 
                    $or: [
                        { _id: new ObjectId(String(service.tecnico_id)) },
                        { id: String(service.tecnico_id) }
                    ]
                });
                if (tecUser) {
                    tecnicoNome = tecUser.nome;
                }
            } catch (e) {
                // ignore
            }
        }

        const fotosContexto = normalizeContextPhotos(service);
        const serviceFormatted = {
            ...service,
            id: service._id?.toString(),
            tecnico: tecnicoNome,
            nome_tecnico: tecnicoNome,
            numero_pedido: service.numero_pedido ?? null,
            foto_url: service.foto_url ?? normalizePhotoUrls(service)[0] ?? null,
            fotos_urls: normalizePhotoUrls(service),
            fotos_contexto: fotosContexto,
            fotos_porta_cliente_urls: fotosContexto.porta_cliente.map((item) => item?.url).filter(Boolean),
            fotos_instalacoes_urls: fotosContexto.instalacoes.map((item) => item?.url).filter(Boolean),
            has_comprovante: !!(service.comprovante_pagamento && service.comprovante_pagamento.fileId),
        };

        console.log(chalk.blue(`Sistema 💻 : Serviço encontrado: ${id} 🔍`));

        return res.status(200).json({
            message: "Serviço encontrado com sucesso!",
            service: serviceFormatted,
        });
    } catch (error) {
        console.error("Erro ao buscar serviço:", error);
        return res.status(500).json({ error: "Erro interno no servidor" });
    }
};
