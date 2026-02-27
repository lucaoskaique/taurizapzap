import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface User {
    nome: string;
    numero: string; // JID completo (ex: 5511999990001@s.whatsapp.net ou 256023168307270@lid)
    isLID: boolean;
}

interface UsersData {
    grupoId: string | null;
    grupoNome: string | null;
    dataAtualizacao: string | null;
    users: User[];
}

/**
 * Gerenciador de usuários do grupo
 */
export class UsersManager {
    private arquivoPath: string;
    private data: UsersData;

    constructor(arquivoPath?: string) {
        this.arquivoPath = arquivoPath || path.join(__dirname, "..", "data", "users.json");
        this.data = this.carregar();
    }

    /**
     * Carrega dados do arquivo
     */
    private carregar(): UsersData {
        if (!fs.existsSync(this.arquivoPath)) {
            return {
                grupoId: null,
                grupoNome: null,
                dataAtualizacao: null,
                users: [],
            };
        }

        try {
            const conteudo = fs.readFileSync(this.arquivoPath, "utf-8").trim();
            if (!conteudo) {
                return {
                    grupoId: null,
                    grupoNome: null,
                    dataAtualizacao: null,
                    users: [],
                };
            }
            return JSON.parse(conteudo);
        } catch (erro) {
            console.error("❌ Erro ao carregar users.json:", erro);
            return {
                grupoId: null,
                grupoNome: null,
                dataAtualizacao: null,
                users: [],
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
            console.error("❌ Erro ao salvar users.json:", erro);
        }
    }

    /**
     * Atualiza a lista de usuários do grupo
     */
    atualizarUsuarios(grupoId: string, grupoNome: string, participantes: Array<{ nome: string; numero: string }>): void {
        this.data = {
            grupoId,
            grupoNome,
            dataAtualizacao: new Date().toISOString(),
            users: participantes.map(p => ({
                nome: p.nome,
                numero: p.numero,
                isLID: p.numero.includes('@lid'),
            })),
        };
        this.salvar();
        console.log(`💾 ${this.data.users.length} usuários salvos em users.json`);
    }

    /**
     * Busca usuário por JID
     */
    buscarPorJID(jid: string): User | null {
        return this.data.users.find(u => u.numero === jid) || null;
    }

    /**
     * Busca usuário por nome
     */
    buscarPorNome(nome: string): User | null {
        return this.data.users.find(u => u.nome.toLowerCase() === nome.toLowerCase()) || null;
    }

    /**
     * Retorna todos os usuários
     */
    getUsuarios(): User[] {
        return [...this.data.users];
    }

    /**
     * Lista todos os usuários (debug)
     */
    listar(): void {
        if (this.data.users.length === 0) {
            console.log("📭 Nenhum usuário cadastrado");
            return;
        }

        console.log(`\n👥 Usuários do grupo "${this.data.grupoNome}" (${this.data.users.length}):`);
        console.log(`📅 Atualizado em: ${this.data.dataAtualizacao}`);
        console.log("");

        this.data.users.forEach((user, i) => {
            const tipo = user.isLID ? "LID" : "Telefone";
            console.log(`   ${i + 1}. ${user.nome} (${tipo})`);
            console.log(`      JID: ${user.numero}`);
        });
        console.log("");
    }

    /**
     * Retorna informações básicas
     */
    getInfo() {
        return {
            grupoId: this.data.grupoId,
            grupoNome: this.data.grupoNome,
            totalUsuarios: this.data.users.length,
            dataAtualizacao: this.data.dataAtualizacao,
        };
    }
}
