import express, { Request, Response } from "express";
import cors from "cors";
import { WhatsAppClient } from "./whatsapp.js";
import { PlacarManager } from "./placar.js";
import { QueridometroBot } from "./queridometro.js";
import { ReacoesManager } from "./reacoes.js";
import { UsersManager } from "./users.js";
import { config, Participante } from "./config.js";

export function criarAPI(
    whatsapp: WhatsAppClient,
    placar: PlacarManager,
    bot: QueridometroBot,
    reacoes?: ReacoesManager,
    users?: UsersManager,
) {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // ── Status ──
    app.get("/status", (_req: Request, res: Response) => {
        const whatsappStatus = whatsapp.getStatus();
        const botEstado = bot.getEstado();

        res.json({
            whatsapp: whatsappStatus,
            bot: botEstado,
            config: {
                grupoId: config.grupoId || "não configurado",
                participantes: config.participantes.length,
                horarioAbertura: config.horarioAbertura,
                horarioFechamento: config.horarioFechamento,
            },
        });
    });

    // ── QR Code ──
    app.get("/qr", (_req: Request, res: Response) => {
        const status = whatsapp.getStatus();

        if (!status.hasQR) {
            return res.json({
                qrCode: null,
                message: "Nenhum QR code disponível",
            });
        }

        return res.json({ qrCode: status.qrCode });
    });

    // ── Placar ──
    app.get("/placar", (_req: Request, res: Response) => {
        const ranking = placar.getRanking();
        res.json({ ranking, placar: placar.getPlacar() });
    });

    app.post("/placar/resetar", (_req: Request, res: Response) => {
        placar.resetar();
        res.json({ message: "Placar zerado com sucesso" });
    });

    // ── Participantes ──
    app.get("/participantes", (_req: Request, res: Response) => {
        res.json({ participantes: config.participantes });
    });

    app.post("/participantes", (req: Request, res: Response) => {
        const { participantes } = req.body as { participantes: Participante[] };

        if (!Array.isArray(participantes)) {
            return res
                .status(400)
                .json({ error: "participantes deve ser um array" });
        }

        // Validar estrutura
        for (const p of participantes) {
            if (!p.nome || !p.numero) {
                return res.status(400).json({
                    error: "Cada participante deve ter nome e numero",
                });
            }
        }

        config.participantes = participantes;
        return res.json({
            message: "Participantes atualizados",
            participantes,
        });
    });

    // ── Buscar participantes do grupo ──
    app.get("/participantes/grupo", async (_req: Request, res: Response) => {
        try {
            if (!config.grupoId) {
                return res
                    .status(400)
                    .json({ error: "grupoId não configurado" });
            }

            const participantesGrupo = await whatsapp.obterParticipantesDoGrupo(
                config.grupoId,
            );
            return res.json({
                grupoId: config.grupoId,
                participantes: participantesGrupo,
                total: participantesGrupo.length,
            });
        } catch (erro) {
            return res.status(500).json({
                error: "Erro ao buscar participantes do grupo",
                details: erro instanceof Error ? erro.message : String(erro),
            });
        }
    });

    // ── Sincronizar participantes com o grupo ──
    app.post(
        "/participantes/sincronizar",
        async (_req: Request, res: Response) => {
            try {
                if (!config.grupoId) {
                    return res
                        .status(400)
                        .json({ error: "grupoId não configurado" });
                }

                // Obter metadata do grupo
                const sock = whatsapp.getSock();
                if (!sock) {
                    return res
                        .status(500)
                        .json({ error: "Socket não disponível" });
                }
                const metadata = await sock.groupMetadata(config.grupoId);
                const grupoNome = metadata.subject;

                const participantesGrupo =
                    await whatsapp.obterParticipantesDoGrupo(config.grupoId);
                config.participantes = participantesGrupo;

                // Atualizar users.json se UsersManager está disponível
                if (users) {
                    users.atualizarUsuarios(
                        config.grupoId,
                        grupoNome,
                        participantesGrupo,
                    );
                }

                return res.json({
                    message: "Participantes sincronizados com sucesso",
                    participantes: participantesGrupo,
                    total: participantesGrupo.length,
                });
            } catch (erro) {
                return res.status(500).json({
                    error: "Erro ao sincronizar participantes",
                    details:
                        erro instanceof Error ? erro.message : String(erro),
                });
            }
        },
    );

    // ── Usuários (users.json) ──
    app.get("/users", (_req: Request, res: Response) => {
        if (!users) {
            return res
                .status(503)
                .json({ error: "UsersManager não disponível" });
        }

        const info = users.getInfo();
        const usuarios = users.getUsuarios();

        return res.json({
            grupoId: info.grupoId,
            grupoNome: info.grupoNome,
            dataAtualizacao: info.dataAtualizacao,
            totalUsuarios: info.totalUsuarios,
            users: usuarios,
        });
    });

    // ── Votação ──
    app.post("/votacao/abrir", async (_req: Request, res: Response) => {
        try {
            await bot.abrirVotacao();
            res.json({ message: "Votação aberta com sucesso" });
        } catch (erro) {
            res.status(500).json({
                error: "Erro ao abrir votação",
                details: erro instanceof Error ? erro.message : String(erro),
            });
        }
    });

    app.post("/votacao/fechar", async (_req: Request, res: Response) => {
        try {
            await bot.fecharVotacao();
            res.json({ message: "Votação fechada com sucesso" });
        } catch (erro) {
            res.status(500).json({
                error: "Erro ao fechar votação",
                details: erro instanceof Error ? erro.message : String(erro),
            });
        }
    });

    app.get("/votacao/pendentes", (_req: Request, res: Response) => {
        const estado = bot.getEstado();
        const pendentes = config.participantes
            .filter((p) => !estado.participantesVotaram.includes(p.nome))
            .map((p) => p.nome);

        res.json({ pendentes });
    });

    // ── Configuração ──
    app.get("/config", (_req: Request, res: Response) => {
        res.json({
            grupoId: config.grupoId,
            participantes: config.participantes,
            horarioAbertura: config.horarioAbertura,
            horarioFechamento: config.horarioFechamento,
            pontosParticipacao: config.pontosParticipacao,
            pontosPenalidade: config.pontosPenalidade,
            simbolos: config.simbolos,
        });
    });

    app.post("/config/grupo", (req: Request, res: Response) => {
        const { grupoId } = req.body as { grupoId: string };

        if (!grupoId) {
            return res.status(400).json({ error: "grupoId é obrigatório" });
        }

        config.grupoId = grupoId;
        return res.json({ message: "Grupo configurado", grupoId });
    });

    app.post("/config/horarios", (req: Request, res: Response) => {
        const { abertura, fechamento } = req.body as {
            abertura?: string;
            fechamento?: string;
        };

        if (abertura) config.horarioAbertura = abertura;
        if (fechamento) config.horarioFechamento = fechamento;

        // Reiniciar bot para aplicar novos horários
        bot.parar();
        bot.iniciar();

        res.json({
            message: "Horários atualizados e bot reiniciado",
            abertura: config.horarioAbertura,
            fechamento: config.horarioFechamento,
        });
    });

    // ── Grupos ──
    app.get("/grupos", (_req: Request, res: Response) => {
        const gruposManager = whatsapp.getGruposManager();
        const grupos = gruposManager.getGrupos();
        const info = gruposManager.getInfo();

        res.json({
            grupos,
            total: grupos.length,
            cache: info,
        });
    });

    app.get("/grupos/info", (_req: Request, res: Response) => {
        const gruposManager = whatsapp.getGruposManager();
        const info = gruposManager.getInfo();

        res.json(info);
    });

    app.post("/grupos/refresh", async (_req: Request, res: Response) => {
        try {
            const status = whatsapp.getStatus();

            if (!status.connected) {
                return res
                    .status(400)
                    .json({ error: "WhatsApp não está conectado" });
            }

            await whatsapp.listarGrupos(true); // Forçar atualização

            const gruposManager = whatsapp.getGruposManager();
            const grupos = gruposManager.getGrupos();

            return res.json({
                message: "Grupos atualizados com sucesso",
                grupos,
                total: grupos.length,
            });
        } catch (erro) {
            return res.status(500).json({
                error: "Erro ao atualizar grupos",
                details: erro instanceof Error ? erro.message : String(erro),
            });
        }
    });

    // ── Mensagens ──
    app.post("/mensagem", async (req: Request, res: Response) => {
        const { jid, texto } = req.body as { jid: string; texto: string };

        if (!jid || !texto) {
            return res
                .status(400)
                .json({ error: "jid e texto são obrigatórios" });
        }

        try {
            await whatsapp.enviarMensagem(jid, texto);
            return res.json({ message: "Mensagem enviada com sucesso" });
        } catch (erro) {
            return res.status(500).json({
                error: "Erro ao enviar mensagem",
                details: erro instanceof Error ? erro.message : String(erro),
            });
        }
    });

    // ── Teste de Emojis e Menções ──
    app.post("/teste/mensagem", async (_req: Request, res: Response) => {
        try {
            if (!config.grupoId) {
                return res
                    .status(400)
                    .json({ error: "grupoId não configurado" });
            }

            if (config.participantes.length === 0) {
                return res
                    .status(400)
                    .json({ error: "Nenhum participante configurado" });
            }

            // Pegar o primeiro participante para testar menção
            const primeiroParticipante = config.participantes[0];

            // Criar mensagem de teste com emojis
            const emojis = config.simbolos.join(" ");
            const texto =
                `🧪 *Teste de Emojis e Menções*\n\n` +
                `Emojis disponíveis: ${emojis}\n\n` +
                `Testando menção: @${primeiroParticipante.nome}\n\n` +
                `Reaja com um dos emojis acima!`;

            const resultado = await whatsapp.enviarMensagemComMencao(
                config.grupoId,
                texto,
                primeiroParticipante.numero,
            );

            // Registrar mensagem para rastreamento de reações
            if (resultado?.key?.id) {
                bot.registrarMensagemTeste(
                    resultado.key.id,
                    primeiroParticipante.nome,
                );
            }

            return res.json({
                message: "Mensagem de teste enviada e registrada com sucesso",
                messageId: resultado?.key?.id,
                emojis: config.simbolos,
                participanteMencionado: primeiroParticipante.nome,
            });
        } catch (erro) {
            return res.status(500).json({
                error: "Erro ao enviar mensagem de teste",
                details: erro instanceof Error ? erro.message : String(erro),
            });
        }
    });

    // ── Reações ──
    app.get("/reacoes", (_req: Request, res: Response) => {
        if (!reacoes) {
            return res
                .status(503)
                .json({ error: "ReacoesManager não disponível" });
        }

        const todasReacoes = reacoes.getReacoes();
        const info = reacoes.getInfo();

        return res.json({
            reacoes: todasReacoes,
            info,
        });
    });

    app.get("/reacoes/estatisticas", (_req: Request, res: Response) => {
        if (!reacoes) {
            return res
                .status(503)
                .json({ error: "ReacoesManager não disponível" });
        }

        const stats = reacoes.getEstatisticas();
        return res.json(stats);
    });

    app.get("/reacoes/filtrar", (req: Request, res: Response) => {
        if (!reacoes) {
            return res
                .status(503)
                .json({ error: "ReacoesManager não disponível" });
        }

        const {
            participanteAvaliado,
            votanteNome,
            emoji,
            isValida,
            isPropriaReacao,
        } = req.query;

        const filtro: any = {};
        if (participanteAvaliado)
            filtro.participanteAvaliado = String(participanteAvaliado);
        if (votanteNome) filtro.votanteNome = String(votanteNome);
        if (emoji) filtro.emoji = String(emoji);
        if (isValida !== undefined) filtro.isValida = isValida === "true";
        if (isPropriaReacao !== undefined)
            filtro.isPropriaReacao = isPropriaReacao === "true";

        const reacoesFireltradas = reacoes.filtrarReacoes(filtro);
        return res.json({
            filtro,
            total: reacoesFireltradas.length,
            reacoes: reacoesFireltradas,
        });
    });

    app.post("/reacoes/resetar", (_req: Request, res: Response) => {
        if (!reacoes) {
            return res
                .status(503)
                .json({ error: "ReacoesManager não disponível" });
        }

        reacoes.resetar();
        return res.json({ message: "Cache de reações resetado com sucesso" });
    });

    // ── Poll (registrar mensagens com nomes de participantes) ──
    app.post("/poll/registrar", async (req: Request, res: Response) => {
        if (!bot) {
            return res.status(503).json({ error: "Bot não disponível" });
        }

        const { messageId, participanteNome } = req.body;

        if (!messageId || !participanteNome) {
            return res.status(400).json({
                error: "Campos obrigatórios: messageId, participanteNome",
            });
        }

        try {
            bot.registrarMensagemPoll(messageId, participanteNome);
            return res.json({
                message: "Mensagem poll registrada com sucesso",
                messageId,
                participanteNome,
            });
        } catch (erro) {
            return res.status(500).json({
                error: "Erro ao registrar mensagem poll",
                details: erro instanceof Error ? erro.message : String(erro),
            });
        }
    });

    // ── Health check ──
    app.get("/health", (_req: Request, res: Response) => {
        res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    return app;
}
