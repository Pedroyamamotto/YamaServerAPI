import mongodb from "mongodb";
const { GridFSBucket, ObjectId  } = mongodb;
import { getDb } from "../db.js";

import FormData from "form-data";

const SERVICE_PHOTO_BUCKET_NAME = "servicePhotos";
const SERVICE_CONTEXT_PHOTO_BUCKET_NAME = "serviceContextPhotos";

const GRIDFS_SERVICE_PHOTO_URL_REGEX = /^\/api\/uploads\/services\/([a-f\d]{24})$/i;
const GRIDFS_SERVICE_CONTEXT_PHOTO_URL_REGEX = /^\/api\/uploads\/services\/context\/([a-f\d]{24})$/i;

let servicePhotoStorageOverride = null;

const buildServicePhotoUrl = (fileId) => `/api/uploads/services/${fileId}`;
const buildServiceContextPhotoUrl = (fileId) => `/api/uploads/services/context/${fileId}`;

const SERVICE_CONTEXT_PROVIDER = String(
    process.env.SERVICE_CONTEXT_STORAGE_PROVIDER || "mongodb"
).toLowerCase();

const SERVICE_CONTEXT_ROOT_FOLDER = process.env.SERVICE_CONTEXT_ROOT_FOLDER || "AppYamma";

const getContextFolderByType = (tipo = "porta_cliente") => {
    const normalized = String(tipo || "").toLowerCase().trim();

    if (["instalacoes", "instalacao", "instalações", "instalação"].includes(normalized)) {
        return "instalacoes";
    }

    return "porta cliente";
};

const extractGridFsFileIdFromUrl = (photoUrl) => {
    if (typeof photoUrl !== "string") return null;
    const match = photoUrl.match(GRIDFS_SERVICE_PHOTO_URL_REGEX);
    return match?.[1] ?? null;
};

const extractGridFsContextFileIdFromUrl = (photoUrl) => {
    if (typeof photoUrl !== "string") return null;
    const match = photoUrl.match(GRIDFS_SERVICE_CONTEXT_PHOTO_URL_REGEX);
    return match?.[1] ?? null;
};

const getServicePhotoBucket = async () => {
    const db = await getDb();
    return new GridFSBucket(db, { bucketName: SERVICE_PHOTO_BUCKET_NAME });
};

const getServiceContextPhotoBucket = async () => {
    const db = await getDb();
    return new GridFSBucket(db, { bucketName: SERVICE_CONTEXT_PHOTO_BUCKET_NAME });
};

const sendToWebhook = async ({ numeroOS, idCliente, tipo, file }) => {
    const formData = new FormData();
    formData.append("numeroOS", numeroOS);
    if (idCliente) formData.append("idCliente", idCliente);
    formData.append("tipo", tipo);
    formData.append("foto", Buffer.from(file.buffer), file.originalname || "foto.jpg");

    try {
        await fetch(
            "https://yamamotto-dev.app.n8n.cloud/webhook/38735c1f-0ed9-4838-9d40-77408745561f",
            {
                method: "POST",
                body: formData,
                headers: formData.getHeaders(),
            }
        );
    } catch (err) {
        console.error("Erro ao enviar para webhook:", err.message);
    }
};

const saveServiceContextPhotosInMongo = async (files, { serviceId, tipo, numeroPedido, idCliente }) => {
    const bucket = await getServiceContextPhotoBucket();
    const folderType = getContextFolderByType(tipo);
    const osFolder = `os-${String(numeroPedido || serviceId)}`;
    const storagePath = `${SERVICE_CONTEXT_ROOT_FOLDER}/Services/${folderType}/${osFolder}`;

    return Promise.all(
        files.map(
            (file, index) =>
                new Promise((resolve, reject) => {
                    const uploadStream = bucket.openUploadStream(
                        file.originalname || `service-context-${serviceId}-${index}`,
                        {
                            contentType: file.mimetype,
                            metadata: {
                                service_id: serviceId,
                                tipo,
                                numero_pedido: numeroPedido || null,
                                storage_path: storagePath,
                                original_name: file.originalname || null,
                                uploaded_at: new Date(),
                            },
                        }
                    );

                    uploadStream.on("error", reject);

                    uploadStream.on("finish", async () => {
                        const fileId = uploadStream.id.toString();

                        // webhook (não bloqueia fluxo)
                        sendToWebhook({
                            numeroOS: numeroPedido || serviceId,
                            idCliente,
                            tipo,
                            file,
                        });

                        resolve({
                            fileId,
                            provider: "mongodb",
                            path: storagePath,
                            url: buildServiceContextPhotoUrl(fileId),
                        });
                    });

                    uploadStream.end(file.buffer);
                })
        )
    );
};

export const saveServicePhotos = async (files = [], serviceId) => {
    if (servicePhotoStorageOverride?.saveServicePhotos) {
        return servicePhotoStorageOverride.saveServicePhotos(files, serviceId);
    }

    if (!Array.isArray(files) || files.length === 0) return [];

    const bucket = await getServicePhotoBucket();

    return Promise.all(
        files.map(
            (file, index) =>
                new Promise((resolve, reject) => {
                    const uploadStream = bucket.openUploadStream(
                        file.originalname || `service-${serviceId}-${index}`,
                        {
                            contentType: file.mimetype,
                            metadata: {
                                service_id: serviceId,
                                uploaded_at: new Date(),
                            },
                        }
                    );

                    uploadStream.on("error", reject);

                    uploadStream.on("finish", () => {
                        const fileId = uploadStream.id.toString();
                        resolve({
                            fileId,
                            url: buildServicePhotoUrl(fileId),
                        });
                    });

                    uploadStream.end(file.buffer);
                })
        )
    );
};

export const deleteServicePhotos = async (photoUrls = []) => {
    if (servicePhotoStorageOverride?.deleteServicePhotos) {
        return servicePhotoStorageOverride.deleteServicePhotos(photoUrls);
    }

    const fileIds = [...new Set(photoUrls.map(extractGridFsFileIdFromUrl).filter(Boolean))];
    if (fileIds.length === 0) return;

    const bucket = await getServicePhotoBucket();

    await Promise.all(
        fileIds.map((fileId) => bucket.delete(new ObjectId(fileId)))
    );
};

export const openServicePhotoDownload = async (fileId) => {
    if (servicePhotoStorageOverride?.openServicePhotoDownload) {
        return servicePhotoStorageOverride.openServicePhotoDownload(fileId);
    }

    if (!ObjectId.isValid(fileId)) return null;

    const bucket = await getServicePhotoBucket();
    const normalizedFileId = new ObjectId(fileId);
    const fileDocument = await bucket.find({ _id: normalizedFileId }).next();

    if (!fileDocument) return null;

    return {
        file: fileDocument,
        stream: bucket.openDownloadStream(normalizedFileId),
    };
};

export const saveServiceContextPhotos = async (files = [], options = {}) => {
    if (servicePhotoStorageOverride?.saveServiceContextPhotos) {
        return servicePhotoStorageOverride.saveServiceContextPhotos(files, options);
    }

    if (!Array.isArray(files) || files.length === 0) return [];

    return saveServiceContextPhotosInMongo(files, options);
};

export const deleteServiceContextPhotos = async (photoUrls = []) => {
    if (servicePhotoStorageOverride?.deleteServiceContextPhotos) {
        return servicePhotoStorageOverride.deleteServiceContextPhotos(photoUrls);
    }

    const fileIds = [...new Set(photoUrls.map(extractGridFsContextFileIdFromUrl).filter(Boolean))];
    if (fileIds.length === 0) return;

    const bucket = await getServiceContextPhotoBucket();

    await Promise.all(
        fileIds.map((fileId) => bucket.delete(new ObjectId(fileId)))
    );
};

export const openServiceContextPhotoDownload = async (fileId) => {
    if (servicePhotoStorageOverride?.openServiceContextPhotoDownload) {
        return servicePhotoStorageOverride.openServiceContextPhotoDownload(fileId);
    }

    if (!ObjectId.isValid(fileId)) return null;

    const bucket = await getServiceContextPhotoBucket();
    const normalizedFileId = new ObjectId(fileId);
    const fileDocument = await bucket.find({ _id: normalizedFileId }).next();

    if (!fileDocument) return null;

    return {
        file: fileDocument,
        stream: bucket.openDownloadStream(normalizedFileId),
    };
};

export {
    buildServicePhotoUrl,
    buildServiceContextPhotoUrl,
    extractGridFsFileIdFromUrl,
    extractGridFsContextFileIdFromUrl,
};

// Mocks para testes unitários (não afetam produção)
export function resetServicePhotoStorageForTests() {
    servicePhotoStorageOverride = null;
}
export function setServicePhotoStorageForTests(storage = {}) {
    servicePhotoStorageOverride = storage;
}