import fs from 'fs';
import { config } from './config.js';

export interface Placar {
  [nome: string]: number;
}

export interface RankingItem {
  nome: string;
  pontos: number;
}

/**
 * Gerenciador do placar do queridômetro
 */
export class PlacarManager {
  private caminho: string;
  private placar: Placar;

  constructor(caminho: string = config.caminhoPlacar) {
    this.caminho = caminho;
    this.placar = this.carregar();
  }

  /**
   * Carrega o placar do arquivo ou cria um novo
   */
  private carregar(): Placar {
    try {
      if (fs.existsSync(this.caminho)) {
        const dados = fs.readFileSync(this.caminho, 'utf-8').trim();
        if (!dados) {
          console.log('📂 Arquivo de placar vazio, iniciando novo');
        } else {
          return JSON.parse(dados) as Placar;
        }
      }
    } catch (erro) {
      console.error('Erro ao carregar placar:', erro);
    }

    // Inicializa placar zerado
    const placarInicial: Placar = {};
    config.participantes.forEach(p => {
      placarInicial[p.nome] = 0;
    });
    this.salvar(placarInicial);
    return placarInicial;
  }

  /**
   * Salva o placar no arquivo
   */
  salvar(placar: Placar = this.placar): void {
    try {
      fs.writeFileSync(this.caminho, JSON.stringify(placar, null, 2));
      this.placar = placar;
    } catch (erro) {
      console.error('Erro ao salvar placar:', erro);
      throw erro;
    }
  }

  /**
   * Ajusta pontos de um participante
   */
  ajustarPontos(nome: string, pontos: number): void {
    if (!this.placar[nome]) {
      this.placar[nome] = 0;
    }
    this.placar[nome] += pontos;
    this.salvar();
  }

  /**
   * Retorna o ranking ordenado
   */
  getRanking(): RankingItem[] {
    return Object.entries(this.placar)
      .map(([nome, pontos]) => ({ nome, pontos }))
      .sort((a, b) => b.pontos - a.pontos);
  }

  /**
   * Zera o placar
   */
  resetar(): void {
    const placarZerado: Placar = {};
    config.participantes.forEach(p => {
      placarZerado[p.nome] = 0;
    });
    this.salvar(placarZerado);
  }

  /**
   * Retorna o placar atual
   */
  getPlacar(): Placar {
    return { ...this.placar };
  }
}
