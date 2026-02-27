import fs from 'fs';
import { config } from './config.js';

export interface GrupoInfo {
  id: string;
  nome: string;
  participantesCount: number;
  ultimaAtualizacao: string; // ISO timestamp
}

export interface GruposCache {
  grupos: GrupoInfo[];
  ultimaAtualizacao: string;
}

/**
 * Gerenciador de cache de grupos do WhatsApp
 */
export class GruposManager {
  private caminho: string;
  private cache: GruposCache | null = null;

  constructor(caminho: string = config.caminhoGrupos) {
    this.caminho = caminho;
    this.cache = this.carregar();
  }

  /**
   * Carrega o cache do arquivo
   */
  private carregar(): GruposCache | null {
    try {
      if (fs.existsSync(this.caminho)) {
        const dados = fs.readFileSync(this.caminho, 'utf-8').trim();
        if (!dados) {
          console.log('📂 Arquivo de grupos vazio');
          return null;
        }
        return JSON.parse(dados) as GruposCache;
      }
    } catch (erro) {
      console.error('Erro ao carregar cache de grupos:', erro);
    }
    return null;
  }

  /**
   * Salva o cache no arquivo
   */
  salvar(grupos: GrupoInfo[]): void {
    try {
      const cache: GruposCache = {
        grupos,
        ultimaAtualizacao: new Date().toISOString(),
      };
      
      fs.writeFileSync(this.caminho, JSON.stringify(cache, null, 2));
      this.cache = cache;
      
      console.log(`✅ Cache de grupos salvo: ${grupos.length} grupos`);
    } catch (erro) {
      console.error('Erro ao salvar cache de grupos:', erro);
      throw erro;
    }
  }

  /**
   * Retorna os grupos em cache
   */
  getGrupos(): GrupoInfo[] {
    return this.cache?.grupos || [];
  }

  /**
   * Retorna um grupo específico por ID
   */
  getGrupoPorId(id: string): GrupoInfo | null {
    const grupos = this.getGrupos();
    return grupos.find(g => g.id === id) || null;
  }

  /**
   * Retorna um grupo específico por nome (busca parcial)
   */
  getGrupoPorNome(nome: string): GrupoInfo | null {
    const grupos = this.getGrupos();
    const nomeLower = nome.toLowerCase();
    return grupos.find(g => g.nome.toLowerCase().includes(nomeLower)) || null;
  }

  /**
   * Verifica se o cache existe e está atualizado
   */
  cacheExiste(): boolean {
    return this.cache !== null && this.cache.grupos.length > 0;
  }

  /**
   * Verifica se o cache precisa ser atualizado (mais de 24 horas)
   */
  precisaAtualizar(horasMaximo: number = 24): boolean {
    if (!this.cache) return true;
    
    const agora = new Date().getTime();
    const ultimaAtualizacao = new Date(this.cache.ultimaAtualizacao).getTime();
    const diferencaHoras = (agora - ultimaAtualizacao) / (1000 * 60 * 60);
    
    return diferencaHoras > horasMaximo;
  }

  /**
   * Retorna informações sobre o cache
   */
  getInfo(): { grupos: number; ultimaAtualizacao: string | null; idade: string } {
    if (!this.cache) {
      return { grupos: 0, ultimaAtualizacao: null, idade: 'Sem cache' };
    }

    const agora = new Date().getTime();
    const ultimaAtualizacao = new Date(this.cache.ultimaAtualizacao).getTime();
    const diferencaMinutos = Math.floor((agora - ultimaAtualizacao) / (1000 * 60));
    
    let idade: string;
    if (diferencaMinutos < 60) {
      idade = `${diferencaMinutos} minutos`;
    } else {
      const horas = Math.floor(diferencaMinutos / 60);
      idade = `${horas} horas`;
    }

    return {
      grupos: this.cache.grupos.length,
      ultimaAtualizacao: this.cache.ultimaAtualizacao,
      idade,
    };
  }

  /**
   * Lista grupos no console de forma formatada
   */
  listar(): void {
    const grupos = this.getGrupos();
    
    if (grupos.length === 0) {
      console.log('❌ Nenhum grupo em cache');
      return;
    }

    console.log(`\n📋 ${grupos.length} grupos em cache:\n`);
    grupos.forEach((g, idx) => {
      console.log(`  ${idx + 1}. ${g.nome}`);
      console.log(`     ID: ${g.id}`);
      console.log(`     Participantes: ${g.participantesCount}`);
      console.log('');
    });

    const info = this.getInfo();
    console.log(`⏰ Última atualização: ${info.idade} atrás\n`);
  }
}
