import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import request from "supertest";
import fs from "fs";
import path from "path";
import { createApp } from "../index.js";
import { setDbForTests, resetDbForTests } from "../src/db.js";

const RUN_INTEGRATION_TESTS = String(process.env.RUN_INTEGRATION_TESTS || "").toLowerCase() === "true";

const TEST_IMAGE_PATH = path.resolve("./api/tests/test-upload.jpg");
const TEST_IMAGE_CONTENT = Buffer.from("TestImageContent1234567890");

(RUN_INTEGRATION_TESTS ? describe : describe.skip)("UPLOAD REAL: PATCH /api/services/:id envia foto para o Google Drive", () => {
    beforeAll(() => {
        // Cria uma imagem fake para upload
        if (!fs.existsSync(TEST_IMAGE_PATH)) {
            fs.writeFileSync(TEST_IMAGE_PATH, TEST_IMAGE_CONTENT);
        }
    });

    it("deve enviar foto para o Google Drive", async () => {
        // Cria um serviço fake no banco
        const serviceId = new ObjectId();
        const services = new Map([[serviceId.toString(), {
            _id: serviceId,
            numero_pedido: "9999",
            status: "aguardando",
            checklist: [],
            created_at: new Date(),
            updated_at: new Date(),
        }]]);
        setDbForTests({
            collection(name) {
                if (name === "servicos") {
                    return {
                        async findOne(query) {
                            return services.get(query._id.toString()) ?? null;
                        },
                        async updateOne(query, update) {
                            const current = services.get(query._id.toString());
                            if (!current) return { modifiedCount: 0 };
                            services.set(query._id.toString(), { ...current, ...update.$set });
                            return { modifiedCount: 1 };
                        },
                    };
                }
                throw new Error(`Collection não suportada no teste: ${name}`);
            },
        });

        const app = createApp();
        const response = await request(app)
            .patch(`/api/services/${serviceId.toString()}`)
            .field("status", "concluido")
            .field("checklist", JSON.stringify(["item-1"]))
            .field("assinatura", "data:image/png;base64,assinatura")
            .attach("foto", TEST_IMAGE_PATH);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.foto_url.startsWith("https://drive.google.com/")).toBe(true);
        // console.log("URL do arquivo enviado:", response.body.foto_url);
    });

    afterAll(() => {
        resetDbForTests();
    });
});
// Opcional: pode-se implementar a exclusão do arquivo do Drive aqui, se desejar.
