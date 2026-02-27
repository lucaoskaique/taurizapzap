import fs from 'fs';
import { config } from './config.js';

export interface Reacao {
  timestamp: string; // ISO timestamp
  messageId: string; // ID da mensagem que recebeu a reação
  participanteAvaliado: string; // Quem está sendo avaliado
  emoji: string; // Emoji da reação
  votanteJid: string; // JID de quem reagiu
  votanteNome: string | null; // Nome de quem reagiu (se identificado)
  isPropriaReacao: boolean; // Se é reação do próprio bot
  isValida: boolean; // Se a reação conta como voto válido
  grupoId: string; // Grupo onde aconteceu
}

export interface ReacoesCache {
  reacoes: Reacao[];
  dataInicio: string; // ISO timestamp
  totalReacoes: number;
}

/**
 * Gerenciador de cache de reações
 */
export class ReacoesManager {
  private caminho: string;
  private cache: ReacoesCache;

  constructor(caminho: string = config.caminhoReacoes) {
    this.caminho = caminho;
    this.cache = this.carregar();
  }

  /**
   * Carrega cache do arquivo
   */
  private carregar(): ReacoesCache {
    try {
      if (fs.existsSync(this.caminho)) {
        const dados = fs.readFileSync(this.caminho, 'utf-8').trim();
        if (!dados) {
          console.log('📂 Arquivo de reações vazio, iniciando cache novo');
          return {
            reacoes: [],
            dataInicio: new Date().toISOString(),
            totalReacoes: 0,
          };
        }
        const cache = JSON.parse(dados) as ReacoesCache;
        
        // Verificar se é do mesmo dia
        const dataCache = new Date(cache.dataInicio);
        const hoje = new Date();
        
        const mesmoDia = 
          dataCache.getFullYear() === hoje.getFullYear() &&
          dataCache.getMonth() === hoje.getMonth() &&
          dataCache.getDate() === hoje.getDate();
        
        if (mesmoDia) {
          console.log(`📂 Cache de reações carregado: ${cache.totalReacoes} reações`);
          return cache;
        } else {
          console.log('📂 Cache de reações antigo (dia diferente), será resetado');
        }
      }
    } catch (erro) {
      console.error('Erro ao carregar cache de reações:', erro);
    }
    
    // Retornar cache vazio
    return {
      reacoes: [],
      dataInicio: new Date().toISOString(),
      totalReacoes: 0,
    };
  }

  /**
   * Adiciona uma reação ao cache
   */
  adicionarReacao(reacao: Omit<Reacao, 'timestamp'>): void {
    const reacaoCompleta: Reacao = {
      ...reacao,
      timestamp: new Date().toISOString(),
    };

    this.cache.reacoes.push(reacaoCompleta);
    this.cache.totalReacoes = this.cache.reacoes.length;
    this.salvar();
  }

  /**
   * Salva cache no arquivo
   */
  private salvar(): void {
    try {
      fs.writeFileSync(this.caminho, JSON.stringify(this.cache, null, 2));
    } catch (erro) {
      console.error('Erro ao salvar cache de reações:', erro);
      throw erro;
    }
  }

  /**
   * Retorna todas as reações
   */
  getReacoes(): Reacao[] {
    return [...this.cache.reacoes];
  }

  /**
   * Retorna reações filtradas por critérios
   */
  filtrarReacoes(filtro: {
    participanteAvaliado?: string;
    votanteNome?: string;
    emoji?: string;
    isValida?: boolean;
    isPropriaReacao?: boolean;
  }): Reacao[] {
    return this.cache.reacoes.filter(r => {
      if (filtro.participanteAvaliado && r.participanteAvaliado !== filtro.participanteAvaliado) return false;
      if (filtro.votanteNome && r.votanteNome !== filtro.votanteNome) return false;
      if (filtro.emoji && r.emoji !== filtro.emoji) return false;
      if (filtro.isValida !== undefined && r.isValida !== filtro.isValida) return false;
      if (filtro.isPropriaReacao !== undefined && r.isPropriaReacao !== filtro.isPropriaReacao) return false;
      return true;
    });
  }

  /**
   * Conta reações por participante avaliado
   */
  contarPorParticipante(): Record<string, number> {
    const contagem: Record<string, number> = {};
    
    this.cache.reacoes.forEach(r => {
      if (r.isValida) {
        contagem[r.participanteAvaliado] = (contagem[r.participanteAvaliado] || 0) + 1;
      }
    });
    
    return contagem;
  }

  /**
   * Conta reações por emoji
   */
  contarPorEmoji(): Record<string, number> {
    const contagem: Record<string, number> = {};
    
    this.cache.reacoes.forEach(r => {
      contagem[r.emoji] = (contagem[r.emoji] || 0) + 1;
    });
    
    return contagem;
  }

  /**
   * Retorna estatísticas gerais
   */
  getEstatisticas() {
    const total = this.cache.totalReacoes;
    const validas = this.cache.reacoes.filter(r => r.isValida).length;
    const invalidas = total - validas;
    const proprias = this.cache.reacoes.filter(r => r.isPropriaReacao).length;
    const emojis = this.contarPorEmoji();
    const participantes = this.contarPorParticipante();

    return {
      total,
      validas,
      invalidas,
      proprias,
      porEmoji: emojis,
      porParticipante: participantes,
      dataInicio: this.cache.dataInicio,
    };
  }

  /**
   * Limpa o cache (novo dia)
   */
  resetar(): void {
    this.cache = {
      reacoes: [],
      dataInicio: new Date().toISOString(),
      totalReacoes: 0,
    };
    
    try {
      if (fs.existsSync(this.caminho)) {
        fs.unlinkSync(this.caminho);
        console.log('🗑️  Cache de reações removido');
      }
    } catch (erro) {
      console.error('Erro ao remover cache de reações:', erro);
    }
  }

  /**
   * Lista reações no console
   */
  listar(limite: number = 10): void {
    const reacoes = this.cache.reacoes.slice(-limite).reverse();
    
    if (reacoes.length === 0) {
      console.log('❌ Nenhuma reação registrada');
      return;
    }

    console.log(`\n📊 Últimas ${Math.min(limite, reacoes.length)} reações:\n`);
    
    reacoes.forEach((r, idx) => {
      const hora = new Date(r.timestamp).toLocaleTimeString();
      const valida = r.isValida ? '✅' : '⚠️';
      const propria = r.isPropriaReacao ? '(própria)' : '';
      
      console.log(`  ${idx + 1}. [${hora}] ${valida} ${r.emoji} → ${r.participanteAvaliado}`);
      console.log(`     De: ${r.votanteNome || r.votanteJid} ${propria}`);
      console.log(`     Msg: ${r.messageId.substring(0, 20)}...`);
    });
    
    const stats = this.getEstatisticas();
    console.log(`\n📈 Total: ${stats.total} reações (${stats.validas} válidas, ${stats.invalidas} inválidas)\n`);
  }

  /**
   * Retorna informações sobre o cache
   */
  getInfo() {
    return {
      totalReacoes: this.cache.totalReacoes,
      dataInicio: this.cache.dataInicio,
      temDados: this.cache.reacoes.length > 0,
    };
  }
}
