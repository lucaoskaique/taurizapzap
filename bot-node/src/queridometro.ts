import { proto } from "@whiskeysockets/baileys";
import schedule from "node-schedule";
import { WhatsAppClient } from "./whatsapp.js";
import { PlacarManager } from "./placar.js";
import { config } from "./config.js";
import { MensagensManager } from "./mensagens.js";
import { ReacoesManager } from "./reacoes.js";
import { PollManager } from "./poll.js";
import { MensagemCacheManager } from "./mensagemCache.js";

export interface EstadoVotacao {
    mensagensVotacao: Map<string, string>; // messageId -> nome do participante
    votosDodia: Map<string, Set<string>>; // nome votante -> Set de message IDs que reagiu
    reacoesRecebidas: Map<string, Map<string, string>>; // participante -> Map(emoji, votanteNome)
}

/**
 * Bot do Queridômetro
 */
export class QueridometroBot {
    private whatsapp: WhatsAppClient;
    private placar: PlacarManager;
    private mensagens: MensagensManager;
    private reacoes: ReacoesManager;
    private poll: PollManager;
    private mensagemCache: MensagemCacheManager;
    private estado: EstadoVotacao;
    private jobs: schedule.Job[] = [];

    constructor(whatsapp: WhatsAppClient, placar: PlacarManager, mensagens?: MensagensManager, reacoes?: ReacoesManager, poll?: PollManager, mensagemCache?: MensagemCacheManager) {
        this.whatsapp = whatsapp;
        this.placar = placar;
        this.mensagens = mensagens || new MensagensManager();
        this.reacoes = reacoes || new ReacoesManager();
        this.poll = poll || new PollManager();
        this.mensagemCache = mensagemCache || new MensagemCacheManager();
        this.estado = {
            mensagensVotacao: new Map(),
            votosDodia: new Map(),
            reacoesRecebidas: new Map(),
        };

        // Carregar mensagens salvas (se houver votação ativa)
        if (this.mensagens.temVotacaoAtiva()) {
            console.log('📂 Restaurando votação ativa (mensagens individuais)...');
            this.estado.mensagensVotacao = this.mensagens.getMensagensMap();
            this.mensagens.listar();
        }

        // Carregar poll (mensagens com nomes de participantes)
        if (this.poll.temVotacaoAtiva()) {
            console.log('📊 Restaurando poll ativo (mensagens com nomes)...');
            const pollMensagens = this.poll.getMensagensMap();
            pollMensagens.forEach((nome, id) => {
                this.estado.mensagensVotacao.set(id, nome);
            });
            this.poll.listar();
        }

        // Cache de mensagens é carregado automaticamente pelo manager
        if (this.mensagemCache.temVotacaoAtiva()) {
            console.log('💾 Cache de mensagens restaurado (mensagem-cache.json)...');
            this.mensagemCache.listar();
        }

        // Inicializar estado de votação
        this.resetarVotacao();

        // Registrar handlers de mensagens
        this.whatsapp.onMessage((msg) => this.processarMensagem(msg));
    }

    /**
     * Inicia o bot com agendamentos
     */
    iniciar(): void {
        console.log("🤖 Iniciando bot do Queridômetro...");

        // Agendar abertura (20h)
        const jobAbertura = schedule.scheduleJob(
            config.horarioAbertura,
            async () => {
                console.log("🕗 Abrindo queridômetro do dia...");
                await this.abrirVotacao();
            },
        );
        this.jobs.push(jobAbertura);

        // Agendar fechamento (22h)
        const jobFechamento = schedule.scheduleJob(
            config.horarioFechamento,
            async () => {
                console.log("🕙 Fechando queridômetro do dia...");
                await this.fecharVotacao();
            },
        );
        this.jobs.push(jobFechamento);

        console.log("📅 Agendamentos configurados:");
        console.log(`  - Abertura: ${config.horarioAbertura}`);
        console.log(`  - Fechamento: ${config.horarioFechamento}`);
    }

    /**
     * Para o bot cancelando agendamentos
     */
    parar(): void {
        this.jobs.forEach((job) => job.cancel());
        this.jobs = [];
        console.log("🛑 Bot parado.");
    }

    /**
     * Reseta o estado de votação do dia
     */
    private resetarVotacao(): void {
        // Só limpar se não houver votação ativa persistida
        if (!this.mensagens.temVotacaoAtiva()) {
            this.estado.mensagensVotacao.clear();
        }
        
        this.estado.votosDodia.clear();
        this.estado.reacoesRecebidas.clear();

        config.participantes.forEach((p) => {
            this.estado.votosDodia.set(p.nome, new Set());
            this.estado.reacoesRecebidas.set(p.nome, new Map());
        });
    }

    /**
     * Verifica se um participante já votou
     */
    private jaVotou(nome: string): boolean {
        const votos = this.estado.votosDodia.get(nome);
        return votos !== undefined && votos.size > 0;
    }

    /**
     * Abre a votação do dia
     */
    async abrirVotacao(): Promise<void> {
        if (!config.grupoId) {
            console.error("❌ GRUPO_ID não configurado!");
            return;
        }

        this.resetarVotacao();

        // Iniciar nova votação no gerenciador de mensagens individuais
        this.mensagens.iniciarVotacao(config.grupoId);
        console.log('💾 Modo mensagens individuais ativado (mensagens.json)');

        // Iniciar poll manager (para mensagens com nomes)
        this.poll.iniciarVotacao(config.grupoId);
        console.log('📊 Modo poll ativado (poll.json)');
        
        // Iniciar cache de mensagens
        this.mensagemCache.iniciarVotacao(config.grupoId);
        console.log('💾 Cache de mensagens ativado (mensagem-cache.json)');

        // Criar legenda de símbolos
        const legenda = config.simbolos.map((emoji) => `${emoji}`).join(" | ");

        // Mensagem de abertura
        await this.whatsapp.enviarMensagem(
            config.grupoId,
            `🗳️ *QUERIDÔMETRO ABERTO!*\n\n` +
                `Reaja nas mensagens com:\n${legenda}\n\n` +
                `⏰ Votação até às 22h\n` +
                `✅ Votar = +${config.pontosParticipacao} pts\n` +
                `❌ Não votar = ${config.pontosPenalidade} pt`,
        );

        console.log(
            `\n📤 Enviando mensagens individuais para ${config.participantes.length} participantes...\n`,
        );

        // Enviar uma mensagem para cada participante
        for (let i = 0; i < config.participantes.length; i++) {
            const participante = config.participantes[i];

            try {
                // Criar texto com menção usando o nome (WhatsApp vai substituir pelo @mention)
                const texto = `${i + 1}. @${participante.nome}`;

                // Enviar mensagem com menção (passa o JID completo para WhatsApp resolver)
                const resultado = await this.whatsapp.enviarMensagemComMencao(
                    config.grupoId,
                    texto,
                    participante.numero,
                );

                console.log(`\n🔍 DEBUG - Mensagem enviada para ${participante.nome}:`);
                console.log('   Resultado completo:', JSON.stringify(resultado, null, 2));

                if (resultado?.key?.id) {
                    console.log(`   ✅ Message ID capturado: ${resultado.key.id}`);
                    console.log(`   📋 Salvando em 4 lugares:`);
                    console.log(`      1. Memória (estado.mensagensVotacao)`);
                    console.log(`      2. mensagens.json`);
                    console.log(`      3. poll.json`);
                    console.log(`      4. Cache de mensagens (com mentions)`);
                    
                    // Salvar em memória
                    this.estado.mensagensVotacao.set(
                        resultado.key.id,
                        participante.nome,
                    );
                    // Salvar em mensagens.json
                    this.mensagens.adicionarMensagem(
                        resultado.key.id,
                        participante.nome,
                    );
                    // Salvar TAMBÉM em poll.json (para fácil referência dos IDs)
                    this.poll.registrarMensagem(
                        resultado.key.id,
                        participante.nome,
                    );
                    // Cache da mensagem com mentions
                    this.mensagemCache.adicionarMensagem(
                        resultado.key.id,
                        texto,
                        [participante.numero],
                        participante.nome
                    );
                    console.log(
                        `   ✅ ${i + 1}. ${participante.nome} (ID: ${resultado.key.id})`,
                    );
                } else {
                    console.log(`   ⚠️  AVISO: Nenhum message ID retornado!`);
                }

                // Pausa entre mensagens para evitar rate limit
                await new Promise((r) => setTimeout(r, 1000));
            } catch (erro) {
                console.error(
                    `   ❌ Erro ao enviar para ${participante.nome}:`,
                    erro,
                );
            }
        }

        console.log(
            `\n📊 ${this.estado.mensagensVotacao.size} mensagens enviadas. Aguardando reações...\n`,
        );
    }

    /**
     * Fecha a votação e penaliza ausentes
     */
    async fecharVotacao(): Promise<void> {
        if (!config.grupoId) return;

        // Quem participou
        const participantes = config.participantes
            .filter((p) => this.jaVotou(p.nome))
            .map((p) => p.nome);

        // Quem faltou
        const ausentes = config.participantes
            .filter((p) => !this.jaVotou(p.nome))
            .map((p) => p.nome);

        let mensagem = "⏰ *Queridômetro encerrado!*\n\n";
        
        // Limpar cache de mensagens
        this.mensagemCache.finalizarVotacao();

        // Resumo de participantes
        if (participantes.length > 0) {
            const listaParticipantes = participantes
                .map((p) => `✅ ${p}: +${config.pontosParticipacao} pontos`)
                .join("\n");
            mensagem += `🎉 *Participaram hoje:*\n${listaParticipantes}\n\n`;
        }

        // Se todos participaram
        if (ausentes.length === 0) {
            mensagem += "Todo mundo participou! Sem penalidades 🎉";
            await this.whatsapp.enviarMensagem(config.grupoId, mensagem);
            return;
        }

        // Penalizar ausentes
        for (const ausente of ausentes) {
            this.placar.ajustarPontos(ausente, config.pontosPenalidade);
        }

        const listaAusentes = ausentes
            .map((a) => `• ${a}: ${config.pontosPenalidade} ponto`)
            .join("\n");

        mensagem += `😴 *Ausentes de hoje:*\n${listaAusentes}\n\n`;
        mensagem += "Use !placar pra ver a classificação.";

        await this.whatsapp.enviarMensagem(config.grupoId, mensagem);

        // Finalizar votação (remove arquivo de mensagens)
        this.mensagens.finalizarVotacao();
        this.poll.finalizarVotacao();
        console.log('💾 Votações finalizadas (mensagens e poll)');
    }

    /**
     * Processa mensagens recebidas
     */
    private async processarMensagem(msg: proto.IWebMessageInfo): Promise<void> {
        const jid = msg.key?.remoteJid;
        if (!jid) return;

        // ── Reações na mensagem de votação ──
        if (msg.message?.reactionMessage) {
            await this.processarReacao(msg, jid);
            return;
        }

        // ── Comandos de texto ──
        if (!jid.endsWith("@g.us")) return; // Só grupos

        const texto =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            "";

        // ── Auto-track messages with participant names during active voting ──
        if (this.poll.temVotacaoAtiva() && texto && msg.key?.id) {
            // ⚠️ FILTRO: Só processar mensagens do grupo de votação configurado
            if (config.grupoId && jid !== config.grupoId) {
                return;
            }

            const textoLower = texto.toLowerCase().trim();
            
            console.log(`\n🔍 DEBUG - Mensagem recebida no grupo:`);
            console.log(`   Texto: "${texto}"`);
            console.log(`   Message ID: ${msg.key.id}`);
            console.log(`   De: ${msg.key.participant || msg.key.remoteJid}`);
            console.log(`   fromMe: ${msg.key.fromMe}`);
            
            // Extract mentions from message
            const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            if (mentions.length > 0) {
                console.log(`   📎 Mentions encontrados: ${mentions.length} - ${mentions.join(", ")}`);
            }
            
            let participanteEncontrado = false;
            
            // Check if message contains a participant name
            for (const participante of config.participantes) {
                if (textoLower === participante.nome.toLowerCase()) {
                    console.log(`   ✅ MATCH por nome! Texto corresponde ao participante: ${participante.nome}`);
                    console.log(`   📝 Auto-tracking message: ${msg.key.id} -> ${participante.nome}`);
                    this.poll.registrarMensagem(msg.key.id, participante.nome);
                    this.estado.mensagensVotacao.set(msg.key.id, participante.nome);
                    this.mensagens.adicionarMensagem(msg.key.id, participante.nome);
                    
                    // Cache message with mentions
                    this.mensagemCache.adicionarMensagem(
                        msg.key.id,
                        texto,
                        mentions,
                        participante.nome
                    );
                    participanteEncontrado = true;
                    break;
                }
            }
            
            // If not matched by name, try to match by mention
            if (!participanteEncontrado && mentions.length > 0) {
                for (const mention of mentions) {
                    const resolved = this.whatsapp.resolverNome(mention);
                    if (resolved) {
                        console.log(`   ✅ MATCH por @mention! JID ${mention} -> ${resolved}`);
                        console.log(`   📝 Auto-tracking message: ${msg.key.id} -> ${resolved}`);
                        this.poll.registrarMensagem(msg.key.id, resolved);
                        this.estado.mensagensVotacao.set(msg.key.id, resolved);
                        this.mensagens.adicionarMensagem(msg.key.id, resolved);
                        
                        // Cache message with mentions
                        this.mensagemCache.adicionarMensagem(
                            msg.key.id,
                            texto,
                            mentions,
                            resolved
                        );
                        participanteEncontrado = true;
                        break;
                    }
                }
                
                // If mention wasn't resolved, still track it with the raw mention
                if (!participanteEncontrado) {
                    const firstMention = mentions[0];
                    console.log(`   ⚠️  @mention não resolvido para nome, salvando JID: ${firstMention}`);
                    console.log(`   📝 Auto-tracking message: ${msg.key.id} -> ${firstMention}`);
                    this.poll.registrarMensagem(msg.key.id, firstMention);
                    this.estado.mensagensVotacao.set(msg.key.id, firstMention);
                    this.mensagens.adicionarMensagem(msg.key.id, firstMention);
                    
                    // Cache message with mentions
                    this.mensagemCache.adicionarMensagem(
                        msg.key.id,
                        texto,
                        mentions,
                        firstMention
                    );
                }
            }
        }

        await this.processarComando(texto, jid);
    }

    /**
     * Processa reação na mensagem de votação
     */
    private async processarReacao(
        msg: proto.IWebMessageInfo,
        _jid: string,
    ): Promise<void> {
        const reacao = msg.message?.reactionMessage;
        if (!reacao) return;

        // ⚠️ FILTRO: Só processar reações do grupo de votação configurado
        const grupoReacao = reacao.key?.remoteJid;
        if (config.grupoId && grupoReacao !== config.grupoId) {
            console.log(`\n⏭️ Ignorando reação de outro grupo (${grupoReacao})`);
            return;
        }

        console.log("\n🔍 ═══════════════════════════════════════");
        console.log("📨 NOVA REAÇÃO RECEBIDA");
        console.log("═══════════════════════════════════════");

        // IMPORTANTE: msg.key.id é o ID da mensagem sendo reagida (correto!)
        // reacao.key.id é o ID da própria reação (errado!)
        const msgId = msg.key?.id;  // ID da mensagem original
        const emoji = reacao.text;
        const votanteJid = msg.key?.participant || msg.key?.remoteJid;
        const isPropriaReacao = msg.key?.fromMe || false;

        console.log("� DEBUG - Estrutura completa da reação:");
        console.log('   msg.message.reactionMessage:', JSON.stringify(reacao, null, 2));
        console.log('   msg.key:', JSON.stringify(msg.key, null, 2));
        console.log("\n📋 Informações da reação:");
        console.log(`   • Emoji: ${emoji || "(vazio)"}`);
        console.log(`   • Message ID sendo reagido: ${msgId || "(vazio)"}`);
        console.log(`   • Votante JID: ${votanteJid || "(vazio)"}`);
        console.log(`   • É própria reação: ${isPropriaReacao ? "SIM" : "NÃO"}`);
        
        // Debug: verificar se este message ID está nos nossos registros
        console.log(`\n🔍 DEBUG - Procurando message ID ${msgId} nos registros:`);
        console.log(`   • Está em estado.mensagensVotacao? ${this.estado.mensagensVotacao.has(msgId || '')}`);
        console.log(`   • Está em poll? ${this.poll.isMensagemRastreada(msgId || '')}`);
        if (msgId) {
            const nomeEstado = this.estado.mensagensVotacao.get(msgId);
            const nomePoll = this.poll.buscarParticipante(msgId);
            console.log(`   • Nome no estado: ${nomeEstado || '(não encontrado)'}`);
            console.log(`   • Nome no poll: ${nomePoll || '(não encontrado)'}`);
        }

        // SEMPRE salvar a reação primeiro (mesmo que seja inválida)
        if (msgId && emoji && votanteJid && config.grupoId) {
            // Debug: check all storage locations
            console.log(`\n🔍 DEBUG - Procurando participante para message ID: ${msgId}`);
            console.log(`   📦 estado.mensagensVotacao: ${this.estado.mensagensVotacao.get(msgId) || '(não encontrado)'}`);
            console.log(`   📦 poll.buscarParticipante: ${this.poll.buscarParticipante(msgId) || '(não encontrado)'}`);
            const cached = this.mensagemCache.buscarMensagem(msgId);
            console.log(`   📦 mensagemCache: ${cached ? `${cached.participanteNome || '(sem nome)'} [${cached.texto}]` : '(não encontrado)'}`);
            console.log(`   📋 IDs em estado: [${Array.from(this.estado.mensagensVotacao.keys()).slice(0, 5).join(', ')}]${this.estado.mensagensVotacao.size > 5 ? '...' : ''}`);
            console.log(`   📋 IDs em poll: [${Array.from(this.poll.getMensagensMap().keys()).slice(0, 5).join(', ')}]${this.poll.getMensagensMap().size > 5 ? '...' : ''}`);
            
            // Get participante name from stored mappings (set when we sent the voting message)
            // Priority: estado.mensagensVotacao > poll > mensagemCache
            let participanteAvaliado: string | null = 
                this.estado.mensagensVotacao.get(msgId) || 
                this.poll.buscarParticipante(msgId) || 
                cached?.participanteNome || 
                null;
            
            if (participanteAvaliado) {
                console.log(`   ✅ Participante encontrado: ${participanteAvaliado}`);
            } else {
                // Final fallback: use message ID as identifier
                participanteAvaliado = `msg:${msgId}`;
                console.log(`   ⚠️  NENHUM DADO ENCONTRADO!`);
                console.log(`   ⚠️  Possíveis causas:`);
                console.log(`      1. Bot foi reiniciado e dados não foram restaurados`);
                console.log(`      2. Mensagem não foi enviada pelo bot (mensagem manual)`);
                console.log(`      3. Arquivos poll.json/mensagem-cache.json estão vazios ou corrompidos`);
                console.log(`   ⚠️  Usando fallback: ${participanteAvaliado}`);
            }
            const votanteNome = this.whatsapp.resolverNome(votanteJid);
            const emojiValido = config.simbolos.includes(emoji);
            const isMensagemVotacao = this.estado.mensagensVotacao.has(msgId) || this.poll.isMensagemRastreada(msgId);
            const isValida = isMensagemVotacao && emojiValido && !isPropriaReacao;

            this.reacoes.adicionarReacao({
                messageId: msgId,
                participanteAvaliado,
                emoji,
                votanteJid,
                votanteNome,
                isPropriaReacao,
                isValida,
                grupoId: config.grupoId,
            });

            console.log(`💾 Reação salva em reacoes.json (válida: ${isValida})`);
        }

        // VALIDAÇÃO 1: Message ID existe?
        console.log("\n✅ VALIDAÇÃO 1: Message ID existe?");
        if (!msgId) {
            console.log("   ❌ FALHOU: Sem message ID\n");
            return;
        }
        console.log("   ✓ OK: Message ID presente");

        // VALIDAÇÃO 2: É uma mensagem registrada?
        console.log("\n✅ VALIDAÇÃO 2: Mensagem está registrada para votação?");
        console.log(
            `   • Mensagens individuais: [${Array.from(this.mensagens.getMensagensMap().keys()).join(", ")}]`,
        );
        console.log(
            `   • Mensagens poll: [${Array.from(this.poll.getMensagensMap().keys()).join(", ")}]`,
        );
        console.log(`   • Message ID da reação: ${msgId}`);

        const isMensagemIndividual = this.estado.mensagensVotacao.has(msgId);
        const isMensagemPoll = this.poll.isMensagemRastreada(msgId);
        
        if (!isMensagemIndividual && !isMensagemPoll) {
            console.log(
                "   ❌ FALHOU: Esta mensagem não está registrada para votação",
            );
            console.log(
                "   ℹ️  Motivo: Reação foi em outra mensagem, não nas mensagens de votação\n",
            );
            return;
        }
        console.log("   ✓ OK: Mensagem encontrada no sistema de votação");

        const participanteAvaliado = this.estado.mensagensVotacao.get(msgId) || this.poll.buscarParticipante(msgId);
        console.log(
            `   • Participante sendo avaliado: ${participanteAvaliado}`,
        );
        console.log(
            `   • Modo: ${isMensagemIndividual ? "Mensagem Individual" : "Poll"}`,
        );

        // VALIDAÇÃO 3: Quem reagiu?
        console.log("\n✅ VALIDAÇÃO 3: Identificar quem reagiu");
        if (!votanteJid) {
            console.log(
                "   ❌ FALHOU: Não foi possível identificar quem reagiu\n",
            );
            return;
        }

        const votanteNome = this.whatsapp.resolverNome(votanteJid);
        if (!votanteNome) {
            console.log(
                `   ❌ FALHOU: Nome não resolvido para JID: ${votanteJid}\n`,
            );
            return;
        }
        console.log(`   ✓ OK: Votante identificado como: ${votanteNome}`);

        // VALIDAÇÃO 4: Emoji é válido?
        console.log("\n✅ VALIDAÇÃO 4: Emoji é válido?");
        console.log(`   • Emoji usado: ${emoji || "(vazio)"}`);
        console.log(`   • Emojis válidos: [${config.simbolos.join(", ")}]`);

        if (!emoji) {
            console.log("   ❌ FALHOU: Sem emoji\n");
            return;
        }

        const emojiValido = config.simbolos.includes(emoji);
        console.log(`   • É válido? ${emojiValido ? "SIM ✓" : "NÃO ✗"}`);

        if (!emojiValido) {
            console.log(
                "   ❌ FALHOU: Emoji não está na lista de emojis aceitos",
            );
            console.log("   ℹ️  Este emoji não conta como voto\n");
            return;
        }
        console.log("   ✓ OK: Emoji aceito");

        // VALIDAÇÃO 5: Registrar voto
        console.log("\n✅ VALIDAÇÃO 5: Registrar voto");

        const jaHaviaVotado = this.jaVotou(votanteNome);
        const votos = this.estado.votosDodia.get(votanteNome);

        if (!votos) {
            console.log("   • Primeira reação deste votante hoje");
            this.estado.votosDodia.set(votanteNome, new Set([msgId]));
            this.placar.ajustarPontos(votanteNome, config.pontosParticipacao);
            console.log(
                `   ✓ VOTO REGISTRADO: ${votanteNome} reagiu com ${emoji} para ${participanteAvaliado}`,
            );
            console.log(
                `   🎉 Pontos adicionados: +${config.pontosParticipacao}`,
            );
        } else if (!votos.has(msgId)) {
            votos.add(msgId);
            console.log(
                `   ✓ VOTO REGISTRADO: ${votanteNome} reagiu com ${emoji} para ${participanteAvaliado}`,
            );

            if (!jaHaviaVotado) {
                this.placar.ajustarPontos(
                    votanteNome,
                    config.pontosParticipacao,
                );
                console.log(
                    `   🎉 Pontos adicionados: +${config.pontosParticipacao}`,
                );
            } else {
                console.log(
                    "   ℹ️  Votante já tinha votado antes (sem pontos extras)",
                );
            }
        } else {
            console.log(
                "   ℹ️  Reação já registrada anteriormente para esta mensagem",
            );
        }

        console.log("═══════════════════════════════════════\n");
    }

    /**
     * Processa comandos de texto
     */
    private async processarComando(texto: string, jid: string): Promise<void> {
        // ⚠️ FILTRO: Só processar comandos do grupo de votação configurado
        if (config.grupoId && jid !== config.grupoId) {
            return;
        }

        const comando = texto.trim().toLowerCase();

        switch (comando) {
            case "!placar":
                await this.enviarPlacar(jid);
                break;

            case "!pendentes":
                await this.enviarPendentes(jid);
                break;

            case "!abrirqueridometro":
                await this.whatsapp.enviarMensagem(
                    jid,
                    "🎯 Abrindo queridômetro manualmente...",
                );
                await this.abrirVotacao();
                break;

            case "!resetarplacar":
                this.placar.resetar();
                await this.whatsapp.enviarMensagem(jid, "🔄 Placar zerado!");
                break;

            case "!ajuda":
                await this.enviarAjuda(jid);
                break;
        }
    }

    /**
     * Envia o placar atual
     */
    private async enviarPlacar(jid: string): Promise<void> {
        const ranking = this.placar.getRanking();

        const medalhas = ["🥇", "🥈", "🥉"];
        const linhas = ranking.map((item, i) => {
            const posicao = i < 3 ? medalhas[i] : `${i + 1}.`;
            return `${posicao} ${item.nome}: *${item.pontos} pts*`;
        });

        await this.whatsapp.enviarMensagem(
            jid,
            `🏆 *Placar Geral*\n\n${linhas.join("\n")}`,
        );
    }

    /**
     * Envia lista de pendentes
     */
    private async enviarPendentes(jid: string): Promise<void> {
        const pendentes = config.participantes
            .filter((p) => !this.jaVotou(p.nome))
            .map((p) => p.nome);

        if (pendentes.length === 0) {
            await this.whatsapp.enviarMensagem(
                jid,
                "✅ Todo mundo já votou hoje!",
            );
            return;
        }

        const lista = pendentes.map((p) => `• ${p}`).join("\n");
        await this.whatsapp.enviarMensagem(
            jid,
            `⏳ *Ainda não votaram hoje:*\n${lista}`,
        );
    }

    /**
     * Envia mensagem de ajuda
     */
    private async enviarAjuda(jid: string): Promise<void> {
        await this.whatsapp.enviarMensagem(
            jid,
            `🤖 *Comandos do Queridômetro*\n\n` +
                `!placar — ranking geral\n` +
                `!pendentes — quem ainda não votou hoje\n` +
                `!abrirqueridometro — abre votação agora (teste)\n` +
                `!resetarplacar — zera o placar\n\n` +
                `Votação abre às 20h e fecha às 22h.\n` +
                `Reaja na mensagem de votação com os emojis!\n` +
                `Votar = +${config.pontosParticipacao} pts | Não votar = ${config.pontosPenalidade} pt`,
        );
    }

    /**
     * Registra uma mensagem de teste para rastreamento de reações
     */
    registrarMensagemTeste(messageId: string, participanteNome: string): void {
        // Se não há votação ativa, iniciar uma
        if (!this.mensagens.temVotacaoAtiva() && config.grupoId) {
            this.mensagens.iniciarVotacao(config.grupoId);
        }
        if (!this.mensagemCache.temVotacaoAtiva() && config.grupoId) {
            this.mensagemCache.iniciarVotacao(config.grupoId);
        }
        
        this.estado.mensagensVotacao.set(messageId, participanteNome);
        this.mensagens.adicionarMensagem(messageId, participanteNome);
        
        // Tentar encontrar o JID do participante
        const participante = config.participantes.find(p => p.nome === participanteNome);
        const mentions = participante ? [participante.numero] : [];
        this.mensagemCache.adicionarMensagem(messageId, `Teste: @${participanteNome}`, mentions, participanteNome);
        
        console.log(
            `🧪 Mensagem de teste registrada: ${messageId} -> ${participanteNome}`,
        );
    }

    /**
     * Registra uma mensagem poll (mensagem com nome de participante)
     */
    registrarMensagemPoll(messageId: string, participanteNome: string): void {
        // Se não há poll ativo, iniciar um
        if (!this.poll.temVotacaoAtiva() && config.grupoId) {
            this.poll.iniciarVotacao(config.grupoId);
        }
        if (!this.mensagemCache.temVotacaoAtiva() && config.grupoId) {
            this.mensagemCache.iniciarVotacao(config.grupoId);
        }
        
        this.poll.registrarMensagem(messageId, participanteNome);
        this.estado.mensagensVotacao.set(messageId, participanteNome);
        
        // Tentar encontrar o JID do participante
        const participante = config.participantes.find(p => p.nome === participanteNome);
        const mentions = participante ? [participante.numero] : [];
        this.mensagemCache.adicionarMensagem(messageId, participanteNome, mentions, participanteNome);
        
        console.log(
            `📊 Mensagem poll registrada: ${messageId} -> ${participanteNome}`,
        );
    }

    /**
     * Retorna estado atual
     */
    getEstado() {
        return {
            votacaoAberta: this.estado.mensagensVotacao.size > 0,
            totalMensagens: this.estado.mensagensVotacao.size,
            participantesVotaram: Array.from(this.estado.votosDodia.entries())
                .filter(([_, votos]) => votos.size > 0)
                .map(([nome]) => nome),
        };
    }
}
