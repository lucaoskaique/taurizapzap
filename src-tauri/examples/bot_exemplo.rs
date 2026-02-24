// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

//! Exemplo de uso do bot de queridômetro
//!
//! Para rodar este exemplo:
//! ```bash
//! cargo run --example bot_exemplo
//! ```

use app::bot::{ConfigBot, Participante};
use app::whatsapp::WhatsAppClient;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Setup logging
    env_logger::init();

    println!("🤖 Iniciando Bot do Queridômetro...\n");

    // Configuração de exemplo
    let config = ConfigBot {
        grupo_id: "120363XXXXXXXXX@g.us".to_string(),
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
        horario_abertura: "0 0 20 * * * *".to_string(), // tokio-cron format: sec min hour day month dow year
        horario_fechamento: "0 0 22 * * * *".to_string(),
        pontos_participacao: 2,
        pontos_penalidade: -1,
        caminho_placar: "./placar_exemplo.json".to_string(),
    };

    // Criar cliente
    let client = WhatsAppClient::new(config).await?;

    println!("✅ Bot configurado com sucesso!\n");
    println!("📅 Horários agendados:");
    println!("   - Abertura: 20:00 (todo dia)");
    println!("   - Fechamento: 22:00 (todo dia)\n");

    // Testar comandos
    println!("🧪 Testando comandos...\n");

    // Comando !ajuda
    if let Some(resposta) = client.processar_mensagem("", "!ajuda").await {
        println!("Comando: !ajuda");
        println!("{}\n", resposta);
    }

    // Simular voto
    println!("🗳️  Simulando voto de João...");
    if let Some(resposta) = client.processar_mensagem("5511999990001", "votei").await {
        println!("{}\n", resposta);
    }

    // Ver placar
    if let Some(resposta) = client.processar_mensagem("", "!placar").await {
        println!("Comando: !placar");
        println!("{}\n", resposta);
    }

    // Ver pendentes
    if let Some(resposta) = client.processar_mensagem("", "!pendentes").await {
        println!("Comando: !pendentes");
        println!("{}\n", resposta);
    }

    println!("💡 Dica: Em produção, o bot rodaria continuamente escutando mensagens");
    println!("   do WhatsApp e executando os jobs agendados.\n");

    println!("⚠️  Lembre-se: whatsapp-rust ainda não suporta conexão real.");
    println!("   Este exemplo demonstra apenas a lógica do bot.\n");

    // Manter o scheduler ativo (descomente para testar agendamentos)
    // println!("🔄 Mantendo bot ativo... (Ctrl+C para sair)");
    // client.start().await?;
    // tokio::signal::ctrl_c().await?;
    // println!("\n👋 Bot encerrado!");

    Ok(())
}
