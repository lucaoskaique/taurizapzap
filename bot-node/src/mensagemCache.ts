import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MensagemCache {
    messageId: string;
    texto: string;
    mentions: string[]; // JIDs mentioned in the message
    participanteNome?: string; // Resolved participant name
    timestamp: string;
}

interface CacheData {
    votacaoAtiva: boolean;
    grupoId: string | null;
    dataInicio: string | null;
    mensagens: MensagemCache[];
}

/**
 * Gerenciador de cache de mensagens (persiste mensagens com mentions)
 */
export class MensagemCacheManager {
    private arquivoPath: string;
    private data: CacheData;
    private cache: Map<string, MensagemCache>; // messageId -> MensagemCache

    constructor(arquivoPath?: string) {
        this.arquivoPath = arquivoPath || path.join(__dirname, "..", "mensagem-cache.json");
        this.data = this.carregar();
        this.cache = new Map();
        
        // Carregar mensagens existentes no cache de memória
        this.data.mensagens.forEach(msg => {
            this.cache.set(msg.messageId, msg);
        });
    }

    /**
     * Carrega dados do arquivo
     */
    private carregar(): CacheData {
        if (!fs.existsSync(this.arquivoPath)) {
            return {
                votacaoAtiva: false,
                grupoId: null,
                dataInicio: null,
                mensagens: [],
            };
        }

        try {
            const conteudo = fs.readFileSync(this.arquivoPath, "utf-8").trim();
            if (!conteudo) {
                return {
                    votacaoAtiva: false,
                    grupoId: null,
                    dataInicio: null,
                    mensagens: [],
                };
            }
            return JSON.parse(conteudo);
        } catch (erro) {
            console.error("❌ Erro ao carregar mensagem-cache.json:", erro);
            return {
                votacaoAtiva: false,
                grupoId: null,
                dataInicio: null,
                mensagens: [],
            };
        }
    }

    /**
     * Salva dados no arquivo
     */
    private salvar(): void {
        try {
            this.data.mensagens = Array.from(this.cache.values());
            fs.writeFileSync(this.arquivoPath, JSON.stringify(this.data, null, 2));
        } catch (erro) {
            console.error("❌ Erro ao salvar mensagem-cache.json:", erro);
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
            mensagens: [],
        };
        this.cache.clear();
        this.salvar();
        console.log("💾 Cache de mensagens iniciado (mensagem-cache.json)");
    }

    /**
     * Adiciona uma mensagem ao cache
     */
    adicionarMensagem(messageId: string, texto: string, mentions: string[], participanteNome?: string): void {
        const mensagem: MensagemCache = {
            messageId,
            texto,
            mentions,
            participanteNome,
            timestamp: new Date().toISOString(),
        };
        
        this.cache.set(messageId, mensagem);
        this.salvar();
    }

    /**
     * Busca uma mensagem no cache
     */
    buscarMensagem(messageId: string): MensagemCache | undefined {
        return this.cache.get(messageId);
    }

    /**
     * Verifica se há votação ativa
     */
    temVotacaoAtiva(): boolean {
        return this.data.votacaoAtiva;
    }

    /**
     * Finaliza a votação
     */
    finalizarVotacao(): void {
        this.data.votacaoAtiva = false;
        this.cache.clear();
        this.salvar();
        console.log("🔒 Cache de mensagens finalizado");
    }

    /**
     * Retorna o Map de mensagens (para compatibilidade com código existente)
     */
    getCacheMap(): Map<string, MensagemCache> {
        return this.cache;
    }

    /**
     * Lista mensagens no cache
     */
    listar(): void {
        if (this.cache.size === 0) {
            console.log("📭 Nenhuma mensagem no cache");
            return;
        }

        console.log(`\n📦 Cache de Mensagens (${this.cache.size} mensagens):`);
        this.cache.forEach((msg, id) => {
            console.log(`  ${id}:`);
            console.log(`    Texto: "${msg.texto}"`);
            console.log(`    Mentions: [${msg.mentions.join(", ")}]`);
            console.log(`    Participante: ${msg.participanteNome || "(não definido)"}`);
        });
        console.log("");
    }
}
