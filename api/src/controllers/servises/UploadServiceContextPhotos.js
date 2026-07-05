import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";
import { saveServiceContextPhotos, openServiceContextPhotoDownload, openServicePhotoDownload, extractGridFsFileIdFromUrl } from "../../services/servicePhotoStorage.js";

const resolveContextType = (tipoRaw) => {
    const normalized = String(tipoRaw || "").toLowerCase().trim();

    if (["instalacoes", "instalacao", "instalações", "instalação"].includes(normalized)) {
        return {
            key: "instalacoes",
            label: "instalacoes",
        };
    }

    if (["porta_cliente", "porta cliente", "porta cleinte", "porta"].includes(normalized) || !normalized) {
        return {
            key: "porta_cliente",
            label: "porta cliente",
        };
    }

    return null;
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


// Upload de fotos de contexto, sempre envia para o n8n como tipo "porta_cliente"
export const uploadServiceContextPhotos = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do servico invalido" });
    }
    if (!Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "Envie ao menos 1 imagem no campo foto" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Servico nao encontrado" });
        }
        // Sempre envia para o n8n como tipo "porta_cliente"
        const uploadedPhotos = await saveServiceContextPhotos(req.files, {
            serviceId: id,
            tipo: "porta_cliente",
            numeroPedido: service.numero_pedido,
            idCliente: service.cliente_id,
        });
        const now = new Date();
        await servicosCollection.updateOne(
            { _id: new ObjectId(id) },
            {
                $push: {
                    "fotos_contexto.porta_cliente": { $each: uploadedPhotos },
                },
                $set: { updated_at: now },
            }
        );
        const updatedService = await servicosCollection.findOne({ _id: new ObjectId(id) });
        const fotosContexto = normalizeContextPhotos(updatedService);
        return res.status(200).json({
            success: true,
            message: "Fotos de contexto enviadas com sucesso",
            tipo: "porta_cliente",
            uploaded: uploadedPhotos.length,
            fotos_contexto: fotosContexto,
            fotos_porta_cliente_urls: fotosContexto.porta_cliente.map((item) => item?.url).filter(Boolean),
        });
    } catch (error) {
        console.error("Erro ao enviar fotos de contexto do servico:", {
            serviceId: id,
            message: error.message,
        });
        return res.status(500).json({
            success: false,
            message: "Erro ao salvar fotos de contexto",
            detail: error.message,
        });
    }
};

// Função utilitária para filtrar fotos válidas no GridFS
async function filtrarFotosValidas(fotos, tipo, serviceId, fieldPath, servicosCollection) {
    const isContext = tipo === "porta_cliente";
    const checkFn = isContext ? openServiceContextPhotoDownload : openServicePhotoDownload;
    const result = [];
    const orfas = [];
    for (const foto of fotos) {
        if (!foto?.fileId) continue;
        try {
            const exists = await checkFn(foto.fileId);
            if (exists) {
                result.push({ ...foto, tipo });
            } else {
                orfas.push(foto);
            }
        } catch {
            orfas.push(foto);
        }
    }
    // Remove referências órfãs do banco
    if (orfas.length > 0 && serviceId && fieldPath && servicosCollection) {
        await servicosCollection.updateOne(
            { _id: new ObjectId(serviceId) },
            { $pull: { [fieldPath]: { fileId: { $in: orfas.map(f => f.fileId) } } } }
        );
    }
    return result;
}

// GET fotos de contexto do tipo "porta_cliente"
export const getServiceContextPhotos = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do servico invalido" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Servico nao encontrado" });
        }
        const fotosRaw = service.fotos_contexto?.porta_cliente || [];
        const fotos = await filtrarFotosValidas(fotosRaw, "porta_cliente", id, "fotos_contexto.porta_cliente", servicosCollection);
        return res.status(200).json({ fotos });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar fotos de contexto", detail: error.message });
    }
};

// GET fotos de contexto do tipo "instalacao"
export const getServiceInstalacaoPhotos = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do servico invalido" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Servico nao encontrado" });
        }
        const fotosRaw = service.fotos_contexto?.instalacoes || [];
        const fotos = await filtrarFotosValidas(fotosRaw, "instalacao", id, "fotos_contexto.instalacoes", servicosCollection);
        return res.status(200).json({ fotos });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar fotos de instalacao", detail: error.message });
    }
};

// GET todas as fotos relacionadas ao serviço: porta_cliente, instalacao e conclusão
export const getServiceAllPhotos = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do servico invalido" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Servico nao encontrado" });
        }
        // Fotos contexto
        const fotos_porta_cliente = await filtrarFotosValidas(service.fotos_contexto?.porta_cliente || [], "porta_cliente", id, "fotos_contexto.porta_cliente", servicosCollection);
        const fotos_instalacoes = await filtrarFotosValidas(service.fotos_contexto?.instalacoes || [], "instalacao", id, "fotos_contexto.instalacoes", servicosCollection);
        // Fotos conclusão/instalação legado (fotos_urls, foto_url)
        let fotos_urls = [];
        if (Array.isArray(service.fotos_urls)) {
            fotos_urls = service.fotos_urls.filter(Boolean);
        } else if (service.foto_url) {
            fotos_urls = [service.foto_url];
        }
        // Filtrar apenas URLs válidas do GridFS e remover órfãs do banco
        const fotos_conclusao = [];
        const orfas_conclusao = [];
        for (const url of fotos_urls) {
            const fileId = extractGridFsFileIdFromUrl(url);
            if (fileId) {
                try {
                    const exists = await openServicePhotoDownload(fileId);
                    if (exists) {
                        fotos_conclusao.push({ url, fileId, tipo: "conclusao" });
                    } else {
                        orfas_conclusao.push(url);
                    }
                } catch {
                    orfas_conclusao.push(url);
                }
            }
        }
        // Remove referências órfãs de fotos_urls
        if (orfas_conclusao.length > 0) {
            await servicosCollection.updateOne(
                { _id: new ObjectId(id) },
                { $pull: { fotos_urls: { $in: orfas_conclusao } } }
            );
            // Se foto_url for órfã, zera
            if (orfas_conclusao.includes(service.foto_url)) {
                await servicosCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $unset: { foto_url: "" } }
                );
            }
        }
        return res.status(200).json({
            fotos_porta_cliente,
            fotos_instalacoes,
            fotos_conclusao
        });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar fotos do serviço", detail: error.message });
    }
};
