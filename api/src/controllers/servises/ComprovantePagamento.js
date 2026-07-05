import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";
import { openServicePhotoDownload, saveServicePhotos } from "../../services/servicePhotoStorage.js";

// GET /api/admin/services/comprovante/:id => retorna a imagem do comprovante
export const getComprovantePagamentoImage = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do serviço inválido" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service || !service.comprovante_pagamento || !service.comprovante_pagamento.fileId) {
            return res.status(404).json({ message: "Comprovante não encontrado" });
        }
        const photoDownload = await openServicePhotoDownload(service.comprovante_pagamento.fileId);
        if (!photoDownload) {
            return res.status(404).json({ message: "Arquivo do comprovante não encontrado" });
        }
        const { file, stream } = photoDownload;
        res.setHeader("Content-Type", file.contentType || "application/octet-stream");
        if (typeof file.length === "number") {
            res.setHeader("Content-Length", String(file.length));
        }
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        stream.on("error", (error) => {
            console.error("Erro ao transmitir comprovante do serviço do MongoDB:", {
                fileId: service.comprovante_pagamento.fileId,
                message: error.message,
            });
            if (!res.headersSent) {
                return res.status(500).json({ message: "Erro ao carregar comprovante" });
            }
            res.destroy(error);
        });
        stream.pipe(res);
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar comprovante", detail: error.message });
    }
};

// Upload de comprovante de pagamento (imagem)
export const uploadComprovantePagamento = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do serviço inválido" });
    }
    if (!Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: "Envie ao menos 1 imagem no campo comprovante" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Serviço não encontrado" });
        }
        // Salva imagem no GridFS
        const uploaded = await saveServicePhotos(req.files, id);
        // Salva referência no serviço
        await servicosCollection.updateOne(
            { _id: new ObjectId(id) },
            { 
                $set: { 
                    comprovante_pagamento: uploaded[0],
                    comprovantes_pagamento: uploaded
                } 
            }
        );
        return res.status(200).json({ success: true, comprovante: uploaded[0], comprovantes: uploaded });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao salvar comprovante", detail: error.message });
    }
};

// Exibir comprovante de pagamento
export const getComprovantePagamento = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do serviço inválido" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service || !service.comprovante_pagamento) {
            return res.status(404).json({ message: "Comprovante não encontrado" });
        }
        return res.status(200).json({ comprovante: service.comprovante_pagamento, comprovantes: service.comprovantes_pagamento || [service.comprovante_pagamento] });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao buscar comprovante", detail: error.message });
    }
};
