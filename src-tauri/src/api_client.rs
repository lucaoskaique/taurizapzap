// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

use serde::{Deserialize, Serialize};
use std::error::Error;

/// Cliente HTTP para comunicação com o bot Node.js
#[derive(Clone)]
pub struct BotApiClient {
    base_url: String,
    client: reqwest::Client,
}

// ── Tipos de resposta da API ──

#[derive(Debug, Deserialize, Serialize)]
pub struct StatusResponse {
    pub whatsapp: WhatsAppStatus,
    pub bot: BotStatus,
    pub config: ConfigStatus,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct WhatsAppStatus {
    pub connected: bool,
    #[serde(rename = "hasQR")]
    pub has_qr: bool,
    #[serde(rename = "qrCode")]
    pub qr_code: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct BotStatus {
    #[serde(rename = "enquetesAtivas")]
    pub enquetes_ativas: usize,
    #[serde(rename = "participantesVotaram")]
    pub participantes_votaram: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ConfigStatus {
    #[serde(rename = "grupoId")]
    pub grupo_id: String,
    pub participantes: usize,
    #[serde(rename = "horarioAbertura")]
    pub horario_abertura: String,
    #[serde(rename = "horarioFechamento")]
    pub horario_fechamento: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct QrCodeResponse {
    #[serde(rename = "qrCode")]
    pub qr_code: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct RankingItem {
    pub nome: String,
    pub pontos: i32,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PlacarResponse {
    pub ranking: Vec<RankingItem>,
    pub placar: std::collections::HashMap<String, i32>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Participante {
    pub nome: String,
    pub numero: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ParticipantesResponse {
    pub participantes: Vec<Participante>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PendentesResponse {
    pub pendentes: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ConfigResponse {
    #[serde(rename = "grupoId")]
    pub grupo_id: String,
    pub participantes: Vec<Participante>,
    #[serde(rename = "horarioAbertura")]
    pub horario_abertura: String,
    #[serde(rename = "horarioFechamento")]
    pub horario_fechamento: String,
    #[serde(rename = "pontosParticipacao")]
    pub pontos_participacao: i32,
    #[serde(rename = "pontosPenalidade")]
    pub pontos_penalidade: i32,
    pub simbolos: Vec<String>,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct MessageResponse {
    pub message: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub details: Option<String>,
}

// ── Cliente ──

impl BotApiClient {
    /// Cria um novo cliente da API do bot
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            client: reqwest::Client::new(),
        }
    }

    /// Cria um cliente com URL padrão (localhost:3000)
    pub fn default() -> Self {
        Self::new("http://127.0.0.1:3000")
    }

    // ── Status ──

    /// Retorna status completo do bot
    pub async fn get_status(&self) -> Result<StatusResponse, Box<dyn Error>> {
        let url = format!("{}/status", self.base_url);
        let res = self.client.get(&url).send().await?;
        let status = res.json::<StatusResponse>().await?;
        Ok(status)
    }

    /// Retorna QR code se disponível
    pub async fn get_qr_code(&self) -> Result<QrCodeResponse, Box<dyn Error>> {
        let url = format!("{}/qr", self.base_url);
        let res = self.client.get(&url).send().await?;
        let qr = res.json::<QrCodeResponse>().await?;
        Ok(qr)
    }

    // ── Placar ──

    /// Retorna placar e ranking
    pub async fn get_placar(&self) -> Result<PlacarResponse, Box<dyn Error>> {
        let url = format!("{}/placar", self.base_url);
        let res = self.client.get(&url).send().await?;
        let placar = res.json::<PlacarResponse>().await?;
        Ok(placar)
    }

    /// Zera o placar
    pub async fn resetar_placar(&self) -> Result<MessageResponse, Box<dyn Error>> {
        let url = format!("{}/placar/resetar", self.base_url);
        let res = self.client.post(&url).send().await?;
        let msg = res.json::<MessageResponse>().await?;
        Ok(msg)
    }

    // ── Participantes ──

    /// Lista participantes
    pub async fn get_participantes(&self) -> Result<ParticipantesResponse, Box<dyn Error>> {
        let url = format!("{}/participantes", self.base_url);
        let res = self.client.get(&url).send().await?;
        let participantes = res.json::<ParticipantesResponse>().await?;
        Ok(participantes)
    }

    /// Atualiza participantes
    pub async fn set_participantes(
        &self,
        participantes: Vec<Participante>,
    ) -> Result<ParticipantesResponse, Box<dyn Error>> {
        let url = format!("{}/participantes", self.base_url);
        let body = serde_json::json!({ "participantes": participantes });
        let res = self.client.post(&url).json(&body).send().await?;
        let result = res.json::<ParticipantesResponse>().await?;
        Ok(result)
    }

    // ── Votação ──

    /// Abre votação manualmente
    pub async fn abrir_votacao(&self) -> Result<MessageResponse, Box<dyn Error>> {
        let url = format!("{}/votacao/abrir", self.base_url);
        let res = self.client.post(&url).send().await?;
        let msg = res.json::<MessageResponse>().await?;
        Ok(msg)
    }

    /// Fecha votação manualmente
    pub async fn fechar_votacao(&self) -> Result<MessageResponse, Box<dyn Error>> {
        let url = format!("{}/votacao/fechar", self.base_url);
        let res = self.client.post(&url).send().await?;
        let msg = res.json::<MessageResponse>().await?;
        Ok(msg)
    }

    /// Lista participantes pendentes
    pub async fn get_pendentes(&self) -> Result<PendentesResponse, Box<dyn Error>> {
        let url = format!("{}/votacao/pendentes", self.base_url);
        let res = self.client.get(&url).send().await?;
        let pendentes = res.json::<PendentesResponse>().await?;
        Ok(pendentes)
    }

    // ── Configuração ──

    /// Retorna configuração completa
    pub async fn get_config(&self) -> Result<ConfigResponse, Box<dyn Error>> {
        let url = format!("{}/config", self.base_url);
        let res = self.client.get(&url).send().await?;
        let config = res.json::<ConfigResponse>().await?;
        Ok(config)
    }

    /// Define o grupo do queridômetro
    pub async fn set_grupo(&self, grupo_id: &str) -> Result<MessageResponse, Box<dyn Error>> {
        let url = format!("{}/config/grupo", self.base_url);
        let body = serde_json::json!({ "grupoId": grupo_id });
        let res = self.client.post(&url).json(&body).send().await?;
        let msg = res.json::<MessageResponse>().await?;
        Ok(msg)
    }

    /// Atualiza horários
    pub async fn set_horarios(
        &self,
        abertura: Option<&str>,
        fechamento: Option<&str>,
    ) -> Result<MessageResponse, Box<dyn Error>> {
        let url = format!("{}/config/horarios", self.base_url);
        let mut body = serde_json::Map::new();
        if let Some(a) = abertura {
            body.insert(
                "abertura".to_string(),
                serde_json::Value::String(a.to_string()),
            );
        }
        if let Some(f) = fechamento {
            body.insert(
                "fechamento".to_string(),
                serde_json::Value::String(f.to_string()),
            );
        }
        let res = self
            .client
            .post(&url)
            .json(&serde_json::Value::Object(body))
            .send()
            .await?;
        let msg = res.json::<MessageResponse>().await?;
        Ok(msg)
    }

    // ── Mensagens ──

    /// Envia mensagem para um chat
    pub async fn enviar_mensagem(
        &self,
        jid: &str,
        texto: &str,
    ) -> Result<MessageResponse, Box<dyn Error>> {
        let url = format!("{}/mensagem", self.base_url);
        let body = serde_json::json!({ "jid": jid, "texto": texto });
        let res = self.client.post(&url).json(&body).send().await?;
        let msg = res.json::<MessageResponse>().await?;
        Ok(msg)
    }

    // ── Health ──

    /// Health check
    pub async fn health(&self) -> Result<bool, Box<dyn Error>> {
        let url = format!("{}/health", self.base_url);
        let res = self.client.get(&url).send().await?;
        Ok(res.status().is_success())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        let client = BotApiClient::default();
        assert_eq!(client.base_url, "http://127.0.0.1:3000");
    }

    #[test]
    fn test_client_custom_url() {
        let client = BotApiClient::new("http://localhost:4000");
        assert_eq!(client.base_url, "http://localhost:4000");
    }
}
