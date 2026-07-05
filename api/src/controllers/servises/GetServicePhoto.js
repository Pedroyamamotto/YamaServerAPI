import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import {
    openServicePhotoDownload,
    openServiceContextPhotoDownload,
} from "../../services/servicePhotoStorage.js";

export const getServicePhoto = async (req, res) => {
    const { fileId } = req.params;

    if (!ObjectId.isValid(fileId)) {
        return res.status(400).json({ message: "ID da foto inválido" });
    }

    try {
        const photoDownload = await openServicePhotoDownload(fileId);
        if (!photoDownload) {
            return res.status(404).json({ message: "Foto não encontrada" });
        }

        const { file, stream } = photoDownload;

        res.setHeader("Content-Type", file.contentType || "application/octet-stream");
        if (typeof file.length === "number") {
            res.setHeader("Content-Length", String(file.length));
        }
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

        stream.on("error", (error) => {
            console.error("Erro ao transmitir foto do serviço do MongoDB:", {
                fileId,
                message: error.message,
            });

            if (!res.headersSent) {
                return res.status(500).json({ message: "Erro ao carregar foto" });
            }

            res.destroy(error);
        });

        return stream.pipe(res);
    } catch (error) {
        console.error("Erro ao buscar foto do serviço no MongoDB:", {
            fileId,
            message: error.message,
        });
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};

export const getServiceContextPhoto = async (req, res) => {
    const { fileId } = req.params;

    if (!ObjectId.isValid(fileId)) {
        return res.status(400).json({ message: "ID da foto inválido" });
    }

    try {
        const photoDownload = await openServiceContextPhotoDownload(fileId);
        if (!photoDownload) {
            return res.status(404).json({ message: "Foto de contexto não encontrada" });
        }

        const { file, stream } = photoDownload;

        res.setHeader("Content-Type", file.contentType || "application/octet-stream");
        if (typeof file.length === "number") {
            res.setHeader("Content-Length", String(file.length));
        }
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

        stream.on("error", (error) => {
            console.error("Erro ao transmitir foto de contexto do serviço no MongoDB:", {
                fileId,
                message: error.message,
            });

            if (!res.headersSent) {
                return res.status(500).json({ message: "Erro ao carregar foto de contexto" });
            }

            res.destroy(error);
        });

        return stream.pipe(res);
    } catch (error) {
        console.error("Erro ao buscar foto de contexto do serviço no MongoDB:", {
            fileId,
            message: error.message,
        });
        return res.status(500).json({ message: "Erro interno no servidor" });
    }
};