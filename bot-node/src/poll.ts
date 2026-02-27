import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PollMessage {
    messageId: string;
    participanteNome: string;
    timestamp: string;
}

interface PollData {
    votacaoAtiva: boolean;
    grupoId: string | null;
    dataInicio: string | null;
    mensagensPoll: PollMessage[]; // Messages with participant names (for polls/voting)
}

/**
 * Gerenciador de poll (rastreamento de mensagens com nomes de participantes)
 */
export class PollManager {
    private arquivoPath: string;
    private data: PollData;

    constructor(arquivoPath?: string) {
        this.arquivoPath = arquivoPath || path.join(__dirname, "..", "data", "poll.json");
        this.data = this.carregar();
    }

    /**
     * Carrega dados do arquivo
     */
    private carregar(): PollData {
        if (!fs.existsSync(this.arquivoPath)) {
            return {
                votacaoAtiva: false,
                grupoId: null,
                dataInicio: null,
                mensagensPoll: [],
            };
        }

        try {
            const conteudo = fs.readFileSync(this.arquivoPath, "utf-8").trim();
            if (!conteudo) {
                return {
                    votacaoAtiva: false,
                    grupoId: null,
                    dataInicio: null,
                    mensagensPoll: [],
                };
            }
            const dados = JSON.parse(conteudo);
            
            // Migração: converter mensagensRastreadas para mensagensPoll
            if (dados.mensagensRastreadas && !dados.mensagensPoll) {
                dados.mensagensPoll = dados.mensagensRastreadas;
                delete dados.mensagensRastreadas;
            }
            
            // Garantir que mensagensPoll existe
            if (!dados.mensagensPoll) {
                dados.mensagensPoll = [];
            }
            
            return dados;
        } catch (erro) {
            console.error("❌ Erro ao carregar poll.json:", erro);
            return {
                votacaoAtiva: false,
                grupoId: null,
                dataInicio: null,
                mensagensPoll: [],
            };
        }
    }

    /**
     * Salva dados no arquivo
     */
    private salvar(): void {
        try {
            fs.writeFileSync(this.arquivoPath, JSON.stringify(this.data, null, 2));
        } catch (erro) {
            console.error("❌ Erro ao salvar poll.json:", erro);
        }
    }

    /**
     * Inicia uma nova votação
     */
    iniciarVotacao(grupoId: string): void {
        this.data = {
            votacaoAtiva: true,
            grupoId,
            dataInicio: new Date().toISOString(),
            mensagensPoll: [],
        };
        this.salvar();
        console.log("📊 Nova votação iniciada no poll.json");
    }

    /**
     * Registra uma mensagem poll (mensagem com nome de participante)
     */
    registrarMensagem(messageId: string, participanteNome: string): void {
        if (!this.data.votacaoAtiva) {
            console.warn("⚠️  Tentativa de registrar mensagem sem votação ativa");
            return;
        }

        // Evitar duplicatas
        if (this.data.mensagensPoll.some(m => m.messageId === messageId)) {
            console.log(`ℹ️  Mensagem ${messageId} já está registrada`);
            return;
        }

        this.data.mensagensPoll.push({
            messageId,
            participanteNome,
            timestamp: new Date().toISOString(),
        });

        this.salvar();
        console.log(`✅ Mensagem poll registrada: ${messageId} -> ${participanteNome}`);
    }

    /**
     * Busca o participante associado a uma mensagem
     */
    buscarParticipante(messageId: string): string | null {
        const mensagem = this.data.mensagensPoll.find(m => m.messageId === messageId);
        return mensagem ? mensagem.participanteNome : null;
    }

    /**
     * Verifica se uma mensagem está sendo rastreada
     */
    isMensagemRastreada(messageId: string): boolean {
        return this.data.mensagensPoll.some(m => m.messageId === messageId);
    }

    /**
     * Finaliza a votação atual
     */
    finalizarVotacao(): void {
        this.data = {
            votacaoAtiva: false,
            grupoId: null,
            dataInicio: null,
            mensagensPoll: [],
        };
        this.salvar();
        console.log("🏁 Votação finalizada no poll.json");
    }

    /**
     * Verifica se há votação ativa
     */
    temVotacaoAtiva(): boolean {
        return this.data.votacaoAtiva;
    }

    /**
     * Retorna todas as mensagens rastreadas
     */
    getMensagens(): PollMessage[] {
        return [...this.data.mensagensPoll];
    }

    /**
     * Retorna Map de messageId -> participanteNome (compatibilidade com código existente)
     */
    getMensagensMap(): Map<string, string> {
        const map = new Map<string, string>();
        this.data.mensagensPoll.forEach(m => {
            map.set(m.messageId, m.participanteNome);
        });
        return map;
    }

    /**
     * Lista todas as mensagens rastreadas (debug)
     */
    listar(): void {
        if (!this.data.votacaoAtiva) {
            console.log("ℹ️  Nenhuma votação ativa no poll");
            return;
        }

        console.log(`\n📊 Votação poll ativa desde ${this.data.dataInicio}`);
        console.log(`📝 ${this.data.mensagensPoll.length} mensagens poll rastreadas:\n`);

        this.data.mensagensPoll.forEach((m, i) => {
            console.log(`   ${i + 1}. ${m.participanteNome} (${m.messageId})`);
        });
        console.log();
    }

    /**
     * Retorna estatísticas
     */
    getEstatisticas() {
        return {
            votacaoAtiva: this.data.votacaoAtiva,
            grupoId: this.data.grupoId,
            dataInicio: this.data.dataInicio,
            totalMensagens: this.data.mensagensPoll.length,
        };
    }
}
