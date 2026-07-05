import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../../db.js";
import { deleteServicePhotos, deleteServiceContextPhotos } from "../../services/servicePhotoStorage.js";

// Remove uma foto de contexto ou instalação
export const removeServicePhoto = async (req, res) => {
    const { id, tipo, fileId } = req.params;
    if (!ObjectId.isValid(id) || !fileId || !["porta_cliente","instalacao","conclusao"].includes(tipo)) {
        return res.status(400).json({ message: "Parâmetros inválidos" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Serviço não encontrado" });
        }
        let update = {};
        if (tipo === "porta_cliente") {
            await deleteServiceContextPhotos([`/api/uploads/services/context/${fileId}`]);
            update = { $pull: { "fotos_contexto.porta_cliente": { fileId } } };
        } else if (tipo === "instalacao") {
            await deleteServiceContextPhotos([`/api/uploads/services/context/${fileId}`]);
            update = { $pull: { "fotos_contexto.instalacoes": { fileId } } };
        } else if (tipo === "conclusao") {
            await deleteServicePhotos([`/api/uploads/services/${fileId}`]);
            update = { $pull: { fotos_urls: { $regex: fileId } } };
        }
        await servicosCollection.updateOne({ _id: new ObjectId(id) }, update);
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao remover foto", detail: error.message });
    }
};

// Desconcluir serviço (remove campos de conclusão)
export const desconcluirService = async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID inválido" });
    }
    try {
        const db = await getDb();
        const servicosCollection = db.collection("servicos");
        const service = await servicosCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Serviço não encontrado" });
        }
        // Remove campos de conclusão
        await servicosCollection.updateOne(
            { _id: new ObjectId(id) },
            { $unset: { concluido_em: "", fotos_urls: "", foto_url: "", assinatura: "", assinatura_url: "", checklist: "" }, $set: { status: "aguardando" } }
        );
        return res.status(200).json({ success: true });
    } catch (error) {
        return res.status(500).json({ message: "Erro ao desconcluir serviço", detail: error.message });
    }
};
