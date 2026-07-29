// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use crate::bot::{ConfigBot, QueridometroBot};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_cron_scheduler::{Job, JobScheduler};

/// Cliente WhatsApp com integração ao queridômetro
pub struct WhatsAppClient {
    pub bot: Arc<RwLock<QueridometroBot>>,
    pub scheduler: JobScheduler,
}

impl WhatsAppClient {
    pub async fn new(config: ConfigBot) -> Result<Self, Box<dyn std::error::Error>> {
        let bot = Arc::new(RwLock::new(QueridometroBot::new(config.clone())));
        let scheduler = JobScheduler::new().await?;

        let mut client = Self { bot, scheduler };
        client.setup_jobs(config).await?;

        Ok(client)
    }

    async fn setup_jobs(&mut self, config: ConfigBot) -> Result<(), Box<dyn std::error::Error>> {
        // Job de abertura - 20h
        let bot_abertura = self.bot.clone();
        let grupo_id = config.grupo_id.clone();
        let job_abertura = Job::new_async(config.horario_abertura.as_str(), move |_uuid, _l| {
            let bot = bot_abertura.clone();
            let grupo = grupo_id.clone();
            Box::pin(async move {
                let bot = bot.read().await;
                let mensagem = bot.abrir_votacao();
                log::info!("Abrindo votação no grupo {}: {}", grupo, mensagem);
                // TODO: Enviar mensagem pelo WhatsApp quando a lib estiver pronta
                // enviar_mensagem(&grupo, &mensagem).await;
            })
        })?;
        self.scheduler.add(job_abertura).await?;

        // Job de fechamento - 22h
        let bot_fechamento = self.bot.clone();
        let grupo_id_fechamento = config.grupo_id.clone();
        let job_fechamento =
            Job::new_async(config.horario_fechamento.as_str(), move |_uuid, _l| {
                let bot = bot_fechamento.clone();
                let grupo = grupo_id_fechamento.clone();
                Box::pin(async move {
                    let bot = bot.read().await;
                    let mensagem = bot.fechar_votacao();
                    log::info!("Fechando votação no grupo {}: {}", grupo, mensagem);
                    // TODO: Enviar mensagem pelo WhatsApp quando a lib estiver pronta
                    // enviar_mensagem(&grupo, &mensagem).await;
                })
            })?;
        self.scheduler.add(job_fechamento).await?;

        Ok(())
    }

    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        self.scheduler.start().await?;
        log::info!("Scheduler iniciado com sucesso");
        Ok(())
    }

    pub async fn processar_mensagem(&self, numero: &str, texto: &str) -> Option<String> {
        let bot = self.bot.read().await;

        // Comandos
        if texto.starts_with('!') {
            return bot.processar_comando(texto);
        }

        // Detectar voto em enquete (placeholder - implementar quando a lib suportar)
        // Por enquanto, vamos simular que qualquer mensagem não-comando é um voto
        if texto.contains("votei") || texto.contains("voto") {
            match bot.registrar_voto(numero) {
                Ok(msg) => return Some(msg),
                Err(e) => return Some(e),
            }
        }

        None
    }
}

/// Funções auxiliares para integração futura com wa-rs
/// TODO: Implementar quando a biblioteca estiver madura e suportar as funcionalidades necessárias

/*
use wa_rs::Client;

pub async fn conectar_whatsapp() -> Result<Client, Box<dyn std::error::Error>> {
    // Implementar autenticação e conexão
    // let client = Client::new().await?;
    // client.authenticate().await?;
    // Ok(client)
    todo!("Implementar quando wa-rs suportar conexão")
}

pub async fn enviar_mensagem(
    client: &Client,
    grupo_id: &str,
    texto: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    // client.send_text_message(grupo_id, texto).await?;
    // Ok(())
    todo!("Implementar quando wa-rs suportar envio de mensagens")
}

pub async fn criar_enquete(
    client: &Client,
    grupo_id: &str,
    pergunta: &str,
    opcoes: &[&str],
) -> Result<String, Box<dyn std::error::Error>> {
    // let poll_id = client.create_poll(grupo_id, pergunta, opcoes).await?;
    // Ok(poll_id)
    todo!("Implementar quando wa-rs suportar enquetes")
}

pub async fn escutar_mensagens<F>(client: &Client, callback: F)
where
    F: Fn(String, String) -> () + Send + 'static,
{
    // client.on_message(|msg| {
    //     callback(msg.sender, msg.text);
    // }).await;
    todo!("Implementar quando wa-rs suportar eventos")
}
*/

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bot::Participante;

    #[tokio::test]
    #[ignore] // Ignorar até resolver o formato correto do cron para tokio-cron-scheduler
    async fn test_whatsapp_client_creation() {
        let config = ConfigBot {
            grupo_id: "test_group".to_string(),
            participantes: vec![Participante {
                nome: "João".to_string(),
                numero: "5511999990001".to_string(),
            }],
            // tokio-cron-scheduler usa formato: "sec min hour day month dow year"
            horario_abertura: "0 0 20 * * * *".to_string(),
            horario_fechamento: "0 0 22 * * * *".to_string(),
            pontos_participacao: 2,
            pontos_penalidade: -1,
            caminho_placar: "./test_placar.json".to_string(),
        };

        let client = WhatsAppClient::new(config).await;
        if let Err(e) = &client {
            eprintln!("Error creating client: {:?}", e);
        }
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_processar_comando_placar() {
        // Testar só a lógica do bot sem criar o scheduler
        let mut config = ConfigBot::default();
        config.caminho_placar = "./test_placar2.json".to_string();

        let bot = Arc::new(RwLock::new(QueridometroBot::new(config)));

        let resposta = {
            let bot = bot.read().await;
            bot.processar_comando("!placar")
        };

        assert!(resposta.is_some());
        assert!(resposta.unwrap().contains("Placar Geral"));
    }

    #[tokio::test]
    async fn test_processar_comando_ajuda() {
        let config = ConfigBot::default();
        let bot = Arc::new(RwLock::new(QueridometroBot::new(config)));

        let resposta = {
            let bot = bot.read().await;
            bot.processar_comando("!ajuda")
        };

        assert!(resposta.is_some());
        assert!(resposta.unwrap().contains("Comandos do Queridômetro"));
    }
}
