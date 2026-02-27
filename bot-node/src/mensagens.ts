import fs from 'fs';
import { config } from './config.js';

export interface MensagemVotacao {
  messageId: string;
  participanteNome: string;
  timestamp: string; // ISO timestamp
}

export interface VotacaoAtiva {
  mensagens: MensagemVotacao[];
  dataAbertura: string; // ISO timestamp
  grupoId: string;
}

/**
 * Gerenciador de mensagens de votação
 */
export class MensagensManager {
  private caminho: string;
  private votacao: VotacaoAtiva | null = null;

  constructor(caminho: string = config.caminhoMensagens) {
    this.caminho = caminho;
    this.votacao = this.carregar();
  }

  /**
   * Carrega votação ativa do arquivo
   */
  private carregar(): VotacaoAtiva | null {
    try {
      if (fs.existsSync(this.caminho)) {
        const dados = fs.readFileSync(this.caminho, 'utf-8').trim();
        if (!dados) {
          console.log('📂 Arquivo de mensagens vazio, nenhuma votação ativa');
          return null;
        }
        const votacao = JSON.parse(dados) as VotacaoAtiva;
        
        // Verificar se a votação é do mesmo dia
        const dataVotacao = new Date(votacao.dataAbertura);
        const hoje = new Date();
        
        const mesmoDia = 
          dataVotacao.getFullYear() === hoje.getFullYear() &&
          dataVotacao.getMonth() === hoje.getMonth() &&
          dataVotacao.getDate() === hoje.getDate();
        
        if (mesmoDia) {
          console.log(`📂 Votação ativa carregada: ${votacao.mensagens.length} mensagens`);
          return votacao;
        } else {
          console.log('📂 Votação antiga encontrada (dia diferente), será resetada');
          return null;
        }
      }
    } catch (erro) {
      console.error('Erro ao carregar mensagens de votação:', erro);
    }
    return null;
  }

  /**
   * Inicia uma nova votação
   */
  iniciarVotacao(grupoId: string): void {
    this.votacao = {
      mensagens: [],
      dataAbertura: new Date().toISOString(),
      grupoId,
    };
    this.salvar();
  }

  /**
   * Adiciona uma mensagem de votação
   */
  adicionarMensagem(messageId: string, participanteNome: string): void {
    if (!this.votacao) {
      console.warn('⚠️  Tentando adicionar mensagem sem votação ativa');
      return;
    }

    const mensagem: MensagemVotacao = {
      messageId,
      participanteNome,
      timestamp: new Date().toISOString(),
    };

    this.votacao.mensagens.push(mensagem);
    this.salvar();
  }

  /**
   * Salva votação no arquivo
   */
  private salvar(): void {
    if (!this.votacao) return;

    try {
      fs.writeFileSync(this.caminho, JSON.stringify(this.votacao, null, 2));
    } catch (erro) {
      console.error('Erro ao salvar mensagens de votação:', erro);
      throw erro;
    }
  }

  /**
   * Retorna mapa de messageId -> participanteNome
   */
  getMensagensMap(): Map<string, string> {
    const map = new Map<string, string>();
    
    if (this.votacao) {
      this.votacao.mensagens.forEach(m => {
        map.set(m.messageId, m.participanteNome);
      });
    }
    
    return map;
  }

  /**
   * Verifica se há votação ativa
   */
  temVotacaoAtiva(): boolean {
    return this.votacao !== null && this.votacao.mensagens.length > 0;
  }

  /**
   * Retorna informações sobre a votação ativa
   */
  getInfo(): { ativa: boolean; mensagens: number; grupoId: string | null; dataAbertura: string | null } {
    if (!this.votacao) {
      return { ativa: false, mensagens: 0, grupoId: null, dataAbertura: null };
    }

    return {
      ativa: true,
      mensagens: this.votacao.mensagens.length,
      grupoId: this.votacao.grupoId,
      dataAbertura: this.votacao.dataAbertura,
    };
  }

  /**
   * Verifica se um messageId pertence à votação ativa
   */
  isMensagemVotacao(messageId: string): boolean {
    if (!this.votacao) return false;
    return this.votacao.mensagens.some(m => m.messageId === messageId);
  }

  /**
   * Obtém o nome do participante associado a um messageId
   */
  getParticipante(messageId: string): string | null {
    if (!this.votacao) return null;
    const mensagem = this.votacao.mensagens.find(m => m.messageId === messageId);
    return mensagem?.participanteNome || null;
  }

  /**
   * Finaliza a votação (limpa o arquivo)
   */
  finalizarVotacao(): void {
    this.votacao = null;
    
    try {
      if (fs.existsSync(this.caminho)) {
        fs.unlinkSync(this.caminho);
        console.log('🗑️  Arquivo de votação removido');
      }
    } catch (erro) {
      console.error('Erro ao remover arquivo de votação:', erro);
    }
  }

  /**
   * Reseta a votação (limpa mensagens mas mantém estrutura)
   */
  resetarVotacao(): void {
    this.votacao = null;
    this.finalizarVotacao();
  }

  /**
   * Lista mensagens no console
   */
  listar(): void {
    if (!this.votacao) {
      console.log('❌ Nenhuma votação ativa');
      return;
    }

    console.log(`\n📋 Votação ativa (${this.votacao.mensagens.length} mensagens):\n`);
    console.log(`   Grupo: ${this.votacao.grupoId}`);
    console.log(`   Aberta em: ${new Date(this.votacao.dataAbertura).toLocaleString()}`);
    console.log('\n   Mensagens registradas:');
    
    this.votacao.mensagens.forEach((m, idx) => {
      console.log(`     ${idx + 1}. ${m.participanteNome}`);
      console.log(`        ID: ${m.messageId}`);
      console.log(`        Enviada em: ${new Date(m.timestamp).toLocaleTimeString()}`);
    });
    console.log('');
  }
}
