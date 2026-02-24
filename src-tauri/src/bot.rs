// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use std::fs;

/// Participante do queridômetro
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Participante {
    pub nome: String,
    pub numero: String, // formato: 5511999990001
}

/// Placar geral do queridômetro
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Placar {
    pub pontos: HashMap<String, i32>,
}

impl Placar {
    pub fn new(participantes: &[Participante]) -> Self {
        let mut pontos = HashMap::new();
        for p in participantes {
            pontos.insert(p.nome.clone(), 0);
        }
        Self { pontos }
    }

    pub fn ajustar_pontos(&mut self, nome: &str, pontos: i32) {
        *self.pontos.entry(nome.to_string()).or_insert(0) += pontos;
    }

    pub fn carregar(caminho: &str, participantes: &[Participante]) -> Self {
        if let Ok(contents) = fs::read_to_string(caminho) {
            if let Ok(placar) = serde_json::from_str::<Placar>(&contents) {
                return placar;
            }
        }
        Self::new(participantes)
    }

    pub fn salvar(&self, caminho: &str) -> Result<(), Box<dyn std::error::Error>> {
        let json = serde_json::to_string_pretty(self)?;
        fs::write(caminho, json)?;
        Ok(())
    }

    pub fn ranking(&self) -> Vec<(String, i32)> {
        let mut ranking: Vec<_> = self.pontos.iter()
            .map(|(nome, pontos)| (nome.clone(), *pontos))
            .collect();
        ranking.sort_by(|a, b| b.1.cmp(&a.1));
        ranking
    }
}

/// Estado da votação do dia
#[derive(Debug)]
pub struct EstadoVotacao {
    pub votantes: HashSet<String>,
}

impl EstadoVotacao {
    pub fn new() -> Self {
        Self {
            votantes: HashSet::new(),
        }
    }

    pub fn registrar_voto(&mut self, nome: &str) {
        self.votantes.insert(nome.to_string());
    }

    pub fn ja_votou(&self, nome: &str) -> bool {
        self.votantes.contains(nome)
    }

    pub fn resetar(&mut self) {
        self.votantes.clear();
    }

    pub fn pendentes(&self, participantes: &[Participante]) -> Vec<String> {
        participantes
            .iter()
            .filter(|p| !self.votantes.contains(&p.nome))
            .map(|p| p.nome.clone())
            .collect()
    }
}

/// Configuração do bot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigBot {
    pub grupo_id: String,
    pub participantes: Vec<Participante>,
    pub horario_abertura: String,   // formato cron: "0 20 * * *"
    pub horario_fechamento: String, // formato cron: "0 22 * * *"
    pub pontos_participacao: i32,
    pub pontos_penalidade: i32,
    pub caminho_placar: String,
}

impl Default for ConfigBot {
    fn default() -> Self {
        Self {
            grupo_id: String::new(),
            participantes: vec![
                Participante {
                    nome: "João".to_string(),
                    numero: "5511999990001".to_string(),
                },
                Participante {
                    nome: "Maria".to_string(),
                    numero: "5511999990002".to_string(),
                },
                Participante {
                    nome: "Pedro".to_string(),
                    numero: "5511999990003".to_string(),
                },
                Participante {
                    nome: "Ana".to_string(),
                    numero: "5511999990004".to_string(),
                },
            ],
            // tokio-cron-scheduler usa formato: "sec min hour day month dow year"
            horario_abertura: "0 0 20 * * * *".to_string(),
            horario_fechamento: "0 0 22 * * * *".to_string(),
            pontos_participacao: 2,
            pontos_penalidade: -1,
            caminho_placar: "./placar.json".to_string(),
        }
    }
}

/// Bot do queridômetro
pub struct QueridometroBot {
    pub config: ConfigBot,
    pub placar: Arc<Mutex<Placar>>,
    pub estado: Arc<Mutex<EstadoVotacao>>,
}

impl QueridometroBot {
    pub fn new(config: ConfigBot) -> Self {
        let placar = Placar::carregar(&config.caminho_placar, &config.participantes);
        Self {
            config: config.clone(),
            placar: Arc::new(Mutex::new(placar)),
            estado: Arc::new(Mutex::new(EstadoVotacao::new())),
        }
    }

    pub fn resolver_nome(&self, numero: &str) -> Option<String> {
        self.config
            .participantes
            .iter()
            .find(|p| p.numero == numero)
            .map(|p| p.nome.clone())
    }

    pub fn processar_comando(&self, comando: &str) -> Option<String> {
        match comando {
            "!placar" => {
                let placar = self.placar.lock().unwrap();
                let ranking = placar.ranking();
                let mut texto = "🏆 *Placar Geral*\n\n".to_string();
                for (i, (nome, pontos)) in ranking.iter().enumerate() {
                    texto.push_str(&format!("{}. {} - {} pts\n", i + 1, nome, pontos));
                }
                Some(texto)
            }
            "!pendentes" => {
                let estado = self.estado.lock().unwrap();
                let pendentes = estado.pendentes(&self.config.participantes);
                if pendentes.is_empty() {
                    Some("✅ Todo mundo já votou hoje!".to_string())
                } else {
                    let mut texto = "⏳ *Ainda não votaram hoje:*\n".to_string();
                    for nome in pendentes {
                        texto.push_str(&format!("• {}\n", nome));
                    }
                    Some(texto)
                }
            }
            "!resetarplacar" => {
                let mut placar = self.placar.lock().unwrap();
                *placar = Placar::new(&self.config.participantes);
                if let Err(e) = placar.salvar(&self.config.caminho_placar) {
                    log::error!("Erro ao salvar placar: {}", e);
                }
                Some("🔄 Placar zerado!".to_string())
            }
            "!ajuda" => {
                Some(
                    "🤖 *Comandos do Queridômetro*\n\n\
                    !placar - Ver ranking geral\n\
                    !pendentes - Ver quem ainda não votou hoje\n\
                    !abrirqueridometro - Abrir votação manual\n\
                    !resetarplacar - Zerar o placar\n\
                    !ajuda - Mostrar esta mensagem"
                        .to_string(),
                )
            }
            _ => None,
        }
    }

    pub fn abrir_votacao(&self) -> String {
        let mut estado = self.estado.lock().unwrap();
        estado.resetar();
        
        format!(
            "🎯 *Queridômetro do dia aberto!*\n\n\
            Vote em todos os participantes usando as enquetes.\n\
            Símbolos: ❤️ 💀 ⭐ 😈 🤝\n\n\
            Vocês têm até as 22h. Quem não votar leva {} ponto. ⚠️",
            self.config.pontos_penalidade
        )
    }

    pub fn fechar_votacao(&self) -> String {
        let estado = self.estado.lock().unwrap();
        let ausentes = estado.pendentes(&self.config.participantes);

        if ausentes.is_empty() {
            return "✅ Todo mundo votou hoje! Sem penalidades.".to_string();
        }

        let mut placar = self.placar.lock().unwrap();
        let mut texto = "⏰ *Votação encerrada!*\n\n❌ *Ausentes penalizados:*\n".to_string();

        for ausente in &ausentes {
            placar.ajustar_pontos(ausente, self.config.pontos_penalidade);
            texto.push_str(&format!("• {}: {} ponto\n", ausente, self.config.pontos_penalidade));
        }

        if let Err(e) = placar.salvar(&self.config.caminho_placar) {
            log::error!("Erro ao salvar placar: {}", e);
        }

        texto
    }

    pub fn registrar_voto(&self, numero: &str) -> Result<String, String> {
        if let Some(nome) = self.resolver_nome(numero) {
            let mut estado = self.estado.lock().unwrap();
            
            if estado.ja_votou(&nome) {
                return Err(format!("{} já votou hoje!", nome));
            }

            estado.registrar_voto(&nome);
            
            let mut placar = self.placar.lock().unwrap();
            placar.ajustar_pontos(&nome, self.config.pontos_participacao);
            
            if let Err(e) = placar.salvar(&self.config.caminho_placar) {
                log::error!("Erro ao salvar placar: {}", e);
            }

            Ok(format!(
                "✅ Voto de *{}* registrado! +{} pontos.",
                nome, self.config.pontos_participacao
            ))
        } else {
            Err("Número não encontrado na lista de participantes.".to_string())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_placar_new() {
        let participantes = vec![
            Participante {
                nome: "João".to_string(),
                numero: "5511999990001".to_string(),
            },
            Participante {
                nome: "Maria".to_string(),
                numero: "5511999990002".to_string(),
            },
        ];
        let placar = Placar::new(&participantes);
        assert_eq!(placar.pontos.len(), 2);
        assert_eq!(placar.pontos.get("João"), Some(&0));
        assert_eq!(placar.pontos.get("Maria"), Some(&0));
    }

    #[test]
    fn test_placar_ajustar_pontos() {
        let participantes = vec![Participante {
            nome: "João".to_string(),
            numero: "5511999990001".to_string(),
        }];
        let mut placar = Placar::new(&participantes);
        placar.ajustar_pontos("João", 5);
        assert_eq!(placar.pontos.get("João"), Some(&5));
        placar.ajustar_pontos("João", -2);
        assert_eq!(placar.pontos.get("João"), Some(&3));
    }

    #[test]
    fn test_estado_votacao() {
        let mut estado = EstadoVotacao::new();
        assert!(!estado.ja_votou("João"));
        estado.registrar_voto("João");
        assert!(estado.ja_votou("João"));
    }
}
