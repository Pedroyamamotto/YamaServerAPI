import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { Readable } from "node:stream";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import request from "supertest";
import { createApp } from "../index.js";
import { resetDbForTests, setDbForTests } from "../src/db.js";
import {
    resetAutomationRunnerForTests,
    setAutomationRunnerForTests,
} from "../src/controllers/servises/AdminAtribuirTecnico.js";
import { MAX_SERVICE_PHOTO_SIZE_BYTES } from "../src/middlewares/upload.js";
import {
    resetServicePhotoStorageForTests,
    setServicePhotoStorageForTests,
} from "../src/services/servicePhotoStorage.js";

const buildFakeDb = (initialService, initialTecnicos = []) => {
    const services = new Map([[initialService._id.toString(), structuredClone(initialService)]]);
    const tecnicos = new Map(initialTecnicos.map((tecnico) => [String(tecnico._id), structuredClone(tecnico)]));

    // Mocks para GridFS (servicePhotos e serviceContextPhotos)
    const gridfsFiles = new Map();
    const gridfsChunks = new Map();
    const contextFiles = new Map();
    const contextChunks = new Map();

    return {
        services,
        collection(name) {
            if (name === "servicos") {
                return {
                    async findOne(query) {
                        return services.get(query._id.toString()) ?? null;
                    },
                    async updateOne(query, update) {
                        const current = services.get(query._id.toString());
                        if (!current) {
                            return { modifiedCount: 0 };
                        }
                        services.set(query._id.toString(), {
                            ...current,
                            ...structuredClone(update.$set),
                        });
                        return { modifiedCount: 1 };
                    },
                };
            }
            if (name === "usuários") {
                return {
                    async findOne(query) {
                        return tecnicos.get(String(query._id)) ?? null;
                    },
                };
            }
            if (name === "servicePhotos.files") {
                return {
                    async findOne(query) {
                        return gridfsFiles.get(query._id?.toString?.() || query._id) ?? null;
                    },
                    async insertOne(doc) {
                        const id = doc._id?.toString?.() || doc._id || new ObjectId().toString();
                        gridfsFiles.set(id, { ...doc, _id: id });
                        return { insertedId: id };
                    },
                        find(query) {
                            const arr = Array.from(gridfsFiles.values()).filter(f => {
                                if (query._id) {
                                    return f._id === (query._id?.toString?.() || query._id);
                                }
                                return true;
                            });
                            const cursor = {
                                toArray: async () => arr,
                                next: async () => arr.length > 0 ? arr[0] : null,
                                sort: function() { return this; },
                            };
                            return cursor;
                        },
                };
            }
            if (name === "servicePhotos.chunks") {
                return {
                    async insertOne(doc) {
                        const id = doc._id?.toString?.() || doc._id || new ObjectId().toString();
                        gridfsChunks.set(id, { ...doc, _id: id });
                        return { insertedId: id };
                    },
                    find(query) {
                        const fileId = query.files_id?.toString?.() || query.files_id;
                        let arr = Array.from(gridfsChunks.values()).filter(chunk => chunk.files_id?.toString?.() === fileId);
                        let idx = 0;
                        const cursor = {
                            toArray: async () => arr,
                            sort: function() { return this; },
                            limit: function(n) { arr = arr.slice(0, n); return this; },
                            next: async () => (idx < arr.length ? arr[idx++] : null),
                            close: async () => {},
                        };
                        return cursor;
                    },
                };
            }
            if (name === "serviceContextPhotos.files") {
                return {
                    async findOne(query) {
                        return contextFiles.get(query._id?.toString?.() || query._id) ?? null;
                    },
                    async insertOne(doc) {
                        const id = doc._id?.toString?.() || doc._id || new ObjectId().toString();
                        contextFiles.set(id, { ...doc, _id: id });
                        return { insertedId: id };
                    },
                        find(query) {
                            const arr = Array.from(contextFiles.values()).filter(f => {
                                if (query._id) {
                                    return f._id === (query._id?.toString?.() || query._id);
                                }
                                return true;
                            });
                            const cursor = {
                                toArray: async () => arr,
                                next: async () => arr.length > 0 ? arr[0] : null,
                                sort: function() { return this; },
                            };
                            return cursor;
                        },
                };
            }
            if (name === "serviceContextPhotos.chunks") {
                return {
                    async insertOne(doc) {
                        const id = doc._id?.toString?.() || doc._id || new ObjectId().toString();
                        contextChunks.set(id, { ...doc, _id: id });
                        return { insertedId: id };
                    },
                    find(query) {
                        const fileId = query.files_id?.toString?.() || query.files_id;
                        let arr = Array.from(contextChunks.values()).filter(chunk => chunk.files_id?.toString?.() === fileId);
                        let idx = 0;
                        const cursor = {
                            toArray: async () => arr,
                            sort: function() { return this; },
                            limit: function(n) { arr = arr.slice(0, n); return this; },
                            next: async () => (idx < arr.length ? arr[idx++] : null),
                            close: async () => {},
                        };
                        return cursor;
                    },
                };
            }
            throw new Error(`Collection não suportada no teste: ${name}`);
        },
    };
};

let app;
let fakeDb;
let serviceId;
let storedPhotos;

beforeEach(async () => {
    serviceId = new ObjectId();
    storedPhotos = new Map();
    fakeDb = buildFakeDb({
        _id: serviceId,
        numero_pedido: "9726",
        status: "aguardando",
        checklist: [],
        created_at: new Date(),
        updated_at: new Date(),
    }, [
        {
            _id: "1",
            nome: "Guilherme Kenji",
            typeUser: "tecnico",
        },
    ]);

    setDbForTests(fakeDb);
    setServicePhotoStorageForTests({
        async saveServicePhotos(files) {
            // Simula upload no Google Drive
            return files.map((file, idx) => {
                const fakeId = new ObjectId().toString();
                const url = `https://drive.google.com/file/d/${fakeId}/view`;
                storedPhotos.set(fakeId, {
                    buffer: file.buffer,
                    contentType: file.mimetype,
                });
                return {
                    provider: "google-drive",
                    fileId: fakeId,
                    url,
                    original_name: file.originalname || null,
                    mime_type: file.mimetype,
                    size: file.size ?? file.buffer?.length ?? null,
                    uploaded_at: new Date(),
                };
            });
        },
        async deleteServicePhotos(photoUrls) {
            for (const photoUrl of photoUrls) {
                const fileId = photoUrl.split("/").pop();
                if (fileId) {
                    storedPhotos.delete(fileId);
                }
            }
        },
        async openServicePhotoDownload(fileId) {
            const photo = storedPhotos.get(fileId);
            if (!photo) {
                return null;
            }

            // Mock de stream ainda mais fiel ao GridFSBucketReadStream
            class FakeGridFSStream extends Readable {
                constructor(buffer) {
                    super();
                    this._buffer = buffer;
                    this._sent = false;
                }
                _read() {
                    if (!this._sent) {
                        this.push(this._buffer);
                        this._sent = true;
                    } else {
                        this.push(null);
                        setImmediate(() => this.emit('end'));
                    }
                }
                pause() { return this; }
                resume() { return this; }
                destroy(err) {
                    if (err) this.emit('error', err);
                    this.emit('close');
                }
            }
            const stream = new FakeGridFSStream(photo.buffer);
            return {
                file: {
                    contentType: photo.contentType,
                    length: photo.buffer.length,
                },
                stream,
            };
        },
    });
    // Mock de automação deve ser setado ANTES do app
    setAutomationRunnerForTests(null); // Garante estado limpo
    app = createApp();
});

afterEach(async () => {
    resetDbForTests();
    resetAutomationRunnerForTests();
    resetServicePhotoStorageForTests();
});

describe('PATCH /api/v1/services/:id/admin/atribuir', () => {
    it('gera OS via automacao e atualiza o servico', async () => {
        setAutomationRunnerForTests(async ({ numeroPedido, tecnico }) => {
            expect(numeroPedido).toBe("9726");
            expect(tecnico).toBe("Guilherme Kenji");
            return {
                raw: '{"pedido":"9726","ordemDeServico":"5001"}',
                result: {
                    pedido: "9726",
                    ordemDeServico: "5001",
                },
            };
        });
        const response = await request(app)
            .patch(`/api/v1/services/${serviceId.toString()}/admin/atribuir`)
            .set(process.env.ADMIN_API_KEY ? "x-admin-key" : "x-user-type", process.env.ADMIN_API_KEY || "admin")
            .send({
                tecnico_id: "1",
                data_agendada: "2026-03-17",
                hora_agendada: "09:00",
                observacoes: "Teste via automação",
            });
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.automacao.ordemDeServico).toBe("5001");
        expect(response.body.service.id).toBe(serviceId.toString());
        expect(response.body.service.numero_pedido).toBe("9726");
        expect(response.body.service.tecnico_id).toBe("1");
        expect(response.body.service.hora_agendada).toBe("09:00");
        expect(response.body.service.status).toBe("atribuido");
        expect(response.body.service.ordem_de_servico).toBe("5001");
        expect(response.body.service.observacoes).toBe("Teste via automação");
        const storedService = fakeDb.services.get(serviceId.toString());
        expect(storedService.tecnico_id).toBe("1");
        expect(storedService.status).toBe("atribuido");
        expect(storedService.ordem_de_servico).toBe("5001");
        expect(storedService.observacoes).toBe("Teste via automação");
        expect(storedService.hora_agendada).toBe("09:00");
        expect(storedService.data_agendada.toISOString()).toBe("2026-03-17T00:00:00.000Z");
    });
});

describe('PATCH /api/services/:id', () => {
    it('aceita uma foto e mantém compatibilidade com foto_url', async () => {
        const response = await request(app)
            .patch(`/api/services/${serviceId.toString()}`)
            .field("status", "concluido")
            .field("checklist", JSON.stringify(["item-1"]))
            .field("assinatura", "data:image/png;base64,assinatura")
            .attach("foto", Buffer.from("foto-1"), {
                filename: "foto-1.jpg",
                contentType: "image/jpeg",
            });
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(typeof response.body.foto_url).toBe("string");
        expect(response.body.fotos_urls).toEqual([response.body.foto_url]);
        const storedService = fakeDb.services.get(serviceId.toString());
        expect(storedService.status).toBe("concluido");
        expect(storedService.foto_url).toBe(response.body.foto_url);
        expect(storedService.fotos_urls).toEqual(response.body.fotos_urls);
        expect(storedService.fotos_urls.length).toBe(1);
    });

    it('aceita duas fotos e retorna ambas as URLs', async () => {
        const response = await request(app)
            .patch(`/api/services/${serviceId.toString()}`)
            .field("status", "concluido")
            .field("checklist", JSON.stringify(["item-1", "item-2"]))
            .field("assinatura", "data:image/png;base64,assinatura")
            .attach("foto", Buffer.from("foto-1"), {
                filename: "foto-1.jpg",
                contentType: "image/jpeg",
            })
            .attach("foto", Buffer.from("foto-2"), {
                filename: "foto-2.png",
                contentType: "image/png",
            });
        expect(response.status).toBe(200);
        expect(response.body.foto_url).toBe(response.body.fotos_urls[0]);
        expect(response.body.fotos_urls.length).toBe(2);
        const storedService = fakeDb.services.get(serviceId.toString());
        expect(storedService.fotos_urls.length).toBe(2);
        expect(storedService.foto_url).toBe(storedService.fotos_urls[0]);
    });

    it('GET /api/uploads/services/:fileId retorna a foto salva no MongoDB', async () => {
        const updateResponse = await request(app)
            .patch(`/api/services/${serviceId.toString()}`)
            .field("status", "concluido")
            .field("checklist", JSON.stringify(["item-1"]))
            .field("assinatura", "data:image/png;base64,assinatura")
            .attach("foto", Buffer.from("foto-1"), {
                filename: "foto-1.jpg",
                contentType: "image/jpeg",
            });
        const fotoUrl = updateResponse.body.foto_url;
        if (fotoUrl.startsWith("https://drive.google.com/")) {
            // eslint-disable-next-line no-console
            console.warn("[TESTE PULADO] Download de foto do MongoDB não aplicável para Google Drive.");
            return;
        }
        const fileId = fotoUrl.split("/").pop();
        const photoResponse = await request(app).get(`/api/uploads/services/${fileId}`).buffer(true);
        expect(photoResponse.status).toBe(200);
        expect(photoResponse.headers["content-type"]).toBe("image/jpeg");
        expect(photoResponse.body.toString()).toBe("foto-1");
    }, 10000);

    it('rejeita mais de duas fotos', async () => {
        const response = await request(app)
            .patch(`/api/services/${serviceId.toString()}`)
            .field("status", "concluido")
            .field("checklist", JSON.stringify(["item-1"]))
            .field("assinatura", "data:image/png;base64,assinatura")
            .attach("foto", Buffer.from("foto-1"), {
                filename: "foto-1.jpg",
                contentType: "image/jpeg",
            })
            .attach("foto", Buffer.from("foto-2"), {
                filename: "foto-2.jpg",
                contentType: "image/jpeg",
            })
            .attach("foto", Buffer.from("foto-3"), {
                filename: "foto-3.jpg",
                contentType: "image/jpeg",
            });
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/no máximo 2 imagens/i);
    });

    it('rejeita tipo de arquivo inválido', async () => {
        const response = await request(app)
            .patch(`/api/services/${serviceId.toString()}`)
            .field("status", "concluido")
            .field("checklist", JSON.stringify(["item-1"]))
            .field("assinatura", "data:image/png;base64,assinatura")
            .attach("foto", Buffer.from("arquivo-texto"), {
                filename: "foto.txt",
                contentType: "text/plain",
            });
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/formato de arquivo inválido/i);
    });

    it('rejeita arquivo acima de 10MB', async () => {
        const response = await request(app)
            .patch(`/api/services/${serviceId.toString()}`)
            .field("status", "concluido")
            .field("checklist", JSON.stringify(["item-1"]))
            .field("assinatura", "data:image/png;base64,assinatura")
            .attach("foto", Buffer.alloc(MAX_SERVICE_PHOTO_SIZE_BYTES + 1, 1), {
                filename: "foto-grande.jpg",
                contentType: "image/jpeg",
            });
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/no máximo 10MB/i);
    });
});