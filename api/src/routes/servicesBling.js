import express from "express";
import mongodb from "mongodb";
const { ObjectId  } = mongodb;
import { getDb } from "../db.js";
import { spawn } from "child_process";
import { existsSync } from "node:fs";
import path from "path";

// Sub-rotas para integrar com automacao-bling sem alterar os arquivos existentes.
// POST /api/services/:id/admin/criar-os -> executa o script do automacao-bling e grava o numero da OS no servico.

const router = express.Router();

const AUTOMACAO_DIR = process.env.AUTOMACAO_BLING_DIR || (
    process.env.NODE_ENV === 'production'
        ? path.resolve("automacao")
        : path.resolve("C:/Users/pedra/automacao-bling")
);
const TIMEOUT_MS = Number(process.env.AUTOMACAO_BLING_TIMEOUT_MS || 120000);

function extractLastJsonObject(output) {
    const text = String(output || "").trim();

    for (let start = text.lastIndexOf("{"); start >= 0; start = text.lastIndexOf("{", start - 1)) {
        const candidate = text.slice(start).trim();

        try {
            return JSON.parse(candidate);
        } catch {
            // Continua procurando do fim para o inicio ate achar o ultimo JSON valido.
        }
    }

    throw new Error("Nao foi possivel extrair JSON de retorno da automacao");
}

async function runAutomacaoBling({ numeroPedido, headless = false, debug = false, slowMo = 150, tecnico }) {
    return new Promise((resolve, reject) => {
        const args = ["run", "os", "--", String(numeroPedido), "--salvar"];
        if (headless) args.push("--headless");
        if (debug) args.push("--debug");
        if (slowMo === 0) {
            args.push("--slow", "0");
        }

        const isWindows = process.platform === "win32";
        const command = isWindows ? "cmd.exe" : "npm";
        const commandArgs = isWindows
            ? ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`]
            : args;

        const proc = spawn(command, commandArgs, {
            cwd: AUTOMACAO_DIR,
            env: {
                ...process.env,
                ...(tecnico ? { TECNICO: tecnico } : {}),
            },
            shell: false,
        });

        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            proc.kill("SIGKILL");
            reject(new Error("Automacao bling timeout"));
        }, TIMEOUT_MS);

        proc.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        proc.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        proc.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });

        proc.on("close", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                return reject(new Error(`Automacao bling falhou (code ${code}): ${stderr || stdout}`));
            }
            try {
                const parsed = extractLastJsonObject(stdout);
                return resolve({ raw: stdout, result: parsed });
            } catch (err) {
                return reject(new Error(`JSON invalido retornado pela automacao: ${err.message}`));
            }
        });
    });
}

/**
 * @swagger
 * /api/services/{id}/admin/criar-os:
 *   post:
 *     summary: Criar OS no Bling para um serviço existente
 *     tags: [Admin]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do serviço
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               numero_pedido:
 *                 type: string
 *               tecnico:
 *                 type: string
 *               tecnico_id:
 *                 type: string
 *               data_agendada:
 *                 type: string
 *                 format: date-time
 *               hora_agendada:
 *                 type: string
 *               headless:
 *                 type: boolean
 *               debug:
 *                 type: boolean
 *               slowMo:
 *                 type: integer
 *     responses:
 *       200:
 *         description: OS criada com sucesso
 *       400:
 *         description: Payload inválido
 *       404:
 *         description: Serviço não encontrado
 *       503:
 *         description: Automação indisponível no ambiente
 */
router.post("/services/:id/admin/criar-os", async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        return res.status(400).json({ message: "ID do servico invalido" });
    }

    try {
        const db = await getDb();
        const servicos = db.collection("servicos");
        const service = await servicos.findOne({ _id: new ObjectId(id) });
        if (!service) {
            return res.status(404).json({ message: "Servico nao encontrado" });
        }

        const numeroPedido = req.body.numero_pedido || service.numero_pedido;
        if (!numeroPedido) {
            return res.status(400).json({ message: "numero_pedido ausente no corpo ou no servico" });
        }

        const debug = Boolean(req.body.debug);
        const headless = req.body.headless === true ? true : false;
        const slowMo = Number.isInteger(req.body.slowMo) ? Number(req.body.slowMo) : 150;

        const tecnico = req.body.tecnico || req.body.tecnico_id || service.tecnico_id || process.env.TECNICO || '';
        const dataAgendada = req.body.data_agendada || service.data_agendada;
        const horaAgendada = req.body.hora_agendada || service.hora_agendada;

        if (!existsSync(AUTOMACAO_DIR)) {
            return res.status(503).json({
                success: false,
                message: "Automação não disponível neste ambiente (AUTOMACAO_DIR não encontrado). Configure AUTOMACAO_BLING_DIR.",
            });
        }

        const execResult = await runAutomacaoBling({ numeroPedido, headless, debug, slowMo, tecnico });
        const ordemDeServico = execResult.result?.ordemDeServico || null;

        if (ordemDeServico) {
            const setData = {
                ordem_de_servico: ordemDeServico,
                updated_at: new Date(),
            };

            if (tecnico) {
                setData.tecnico_id = tecnico;
            }
            if (dataAgendada) {
                const data = new Date(dataAgendada);
                if (!isNaN(data.getTime())) {
                    setData.data_agendada = data;
                }
            }
            if (horaAgendada) {
                setData.hora_agendada = horaAgendada;
            }

            await servicos.updateOne(
                { _id: new ObjectId(id) },
                { $set: setData }
            );
        }

        return res.status(200).json({
            success: true,
            message: "OS criada via automacao-bling",
            numero_pedido: numeroPedido,
            ordem_de_servico: ordemDeServico,
            tecnico_utilizado: tecnico,
            data_agendada: dataAgendada || null,
            hora_agendada: horaAgendada || null,
            automacao: execResult.result,
        });
    } catch (err) {
        console.error("Erro ao criar OS via automacao-bling:", err);
        return res.status(500).json({
            message: "Falha ao criar OS via automacao-bling",
            error: err.message,
        });
    }
});

// Endpoint para buscar OS pelo número do pedido usando automacao/buscarOS.js
/**
 * @swagger
 * /api/services/buscar-os:
 *   post:
 *     summary: Buscar número da OS no Bling a partir do número do pedido
 *     tags: [Serviços]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - numero_pedido
 *             properties:
 *               numero_pedido:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resultado da busca da OS
 *       400:
 *         description: numero_pedido ausente
 *       500:
 *         description: Erro na execução da automação
 *       503:
 *         description: Automação indisponível no ambiente
 */
router.post("/services/buscar-os", async (req, res) => {
    const numeroPedido = req.body.numero_pedido;
    if (!numeroPedido) {
        return res.status(400).json({ message: "numero_pedido ausente no corpo" });
    }
    if (!existsSync(AUTOMACAO_DIR)) {
        return res.status(503).json({
            success: false,
            message: "Automação não disponível neste ambiente (AUTOMACAO_DIR não encontrado). Configure AUTOMACAO_BLING_DIR.",
        });
    }

    const scriptPath = path.join(AUTOMACAO_DIR, "ultimaOS.js");
    const isWindows = process.platform === "win32";
    const command = isWindows ? "node.exe" : "node";
    const args = [scriptPath, String(numeroPedido)];
    const proc = spawn(command, args, {
        cwd: AUTOMACAO_DIR,
        env: process.env,
        shell: false,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (code) => {
        if (code !== 0) {
            return res.status(500).json({ message: "Erro ao executar ultimaOS.js", stderr, stdout });
        }
        try {
            const parsed = extractLastJsonObject(stdout);
            return res.status(200).json({ success: true, result: parsed });
        } catch (err) {
            return res.status(500).json({ message: "JSON invalido retornado pelo ultimaOS.js", error: err.message, stdout });
        }
    });
});

export default router;
