// Copyright (c) 2022 Eray Erdin
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.

//! Exemplo de uso do cliente API do bot
//!
//! Para rodar este exemplo:
//! ```bash
//! # Primeiro inicie o bot Node.js em outro terminal:
//! cd bot-node
//! npm run dev
//!
//! # Depois rode o exemplo:
//! cargo run --example api_client_exemplo
//! ```

use app::api_client::{BotApiClient, Participante};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🔗 Testando conexão com o Bot API\n");

    // Criar cliente (conecta ao bot em localhost:3000)
    let client = BotApiClient::default();

    // Health check
    print!("🏥 Health check... ");
    match client.health().await {
        Ok(true) => println!("✅ Bot está online!"),
        Ok(false) => {
            println!("❌ Bot retornou erro");
            return Ok(());
        }
        Err(e) => {
            println!("❌ Não foi possível conectar ao bot");
            println!("   Erro: {}", e);
            println!("\n💡 Certifique-se de que o bot está rodando:");
            println!("   cd bot-node && npm run dev\n");
            return Ok(());
        }
    }

    println!();

    // Status
    println!("📊 Status do Bot:");
    match client.get_status().await {
        Ok(status) => {
            println!("  WhatsApp:");
            println!("    - Conectado: {}", status.whatsapp.connected);
            println!("    - Tem QR: {}", status.whatsapp.has_qr);
            println!("  Bot:");
            println!("    - Enquetes ativas: {}", status.bot.enquetes_ativas);
            println!(
                "    - Votaram hoje: {} pessoas",
                status.bot.participantes_votaram.len()
            );
            println!("  Config:");
            println!("    - Grupo ID: {}", status.config.grupo_id);
            println!("    - Participantes: {}", status.config.participantes);
            println!("    - Abertura: {}", status.config.horario_abertura);
            println!("    - Fechamento: {}", status.config.horario_fechamento);
        }
        Err(e) => println!("  ❌ Erro: {}", e),
    }

    println!();

    // Placar
    println!("🏆 Placar:");
    match client.get_placar().await {
        Ok(placar) => {
            for (i, item) in placar.ranking.iter().enumerate() {
                let medalha = match i {
                    0 => "🥇",
                    1 => "🥈",
                    2 => "🥉",
                    _ => "  ",
                };
                println!(
                    "  {} {}. {} - {} pts",
                    medalha,
                    i + 1,
                    item.nome,
                    item.pontos
                );
            }
        }
        Err(e) => println!("  ❌ Erro: {}", e),
    }

    println!();

    // Participantes
    println!("👥 Participantes:");
    match client.get_participantes().await {
        Ok(resp) => {
            for p in resp.participantes {
                println!("  - {} ({})", p.nome, p.numero);
            }
        }
        Err(e) => println!("  ❌ Erro: {}", e),
    }

    println!();

    // Pendentes
    println!("⏳ Pendentes (não votaram hoje):");
    match client.get_pendentes().await {
        Ok(resp) => {
            if resp.pendentes.is_empty() {
                println!("  ✅ Ninguém está pendente!");
            } else {
                for nome in resp.pendentes {
                    println!("  - {}", nome);
                }
            }
        }
        Err(e) => println!("  ❌ Erro: {}", e),
    }

    println!();

    // Configuração completa
    println!("⚙️  Configuração:");
    match client.get_config().await {
        Ok(config) => {
            println!("  - Grupo: {}", config.grupo_id);
            println!("  - Horário abertura: {}", config.horario_abertura);
            println!("  - Horário fechamento: {}", config.horario_fechamento);
            println!("  - Pontos por votar: +{}", config.pontos_participacao);
            println!("  - Penalidade: {}", config.pontos_penalidade);
            println!("  - Símbolos: {}", config.simbolos.join(", "));
        }
        Err(e) => println!("  ❌ Erro: {}", e),
    }

    println!();

    // Exemplo de operações (comentado para não afetar o placar real)
    println!("💡 Operações disponíveis (comentadas no código):");
    println!("  - client.abrir_votacao().await?");
    println!("  - client.fechar_votacao().await?");
    println!("  - client.resetar_placar().await?");
    println!("  - client.set_grupo(\"120363XXX@g.us\").await?");
    println!("  - client.set_participantes(vec![...]).await?");
    println!("  - client.enviar_mensagem(\"jid\", \"texto\").await?");

    /*
    // Descomente para testar operações:

    // Abrir votação manualmente
    // let resultado = client.abrir_votacao().await?;
    // println!("Votação aberta: {}", resultado.message);

    // Adicionar participante
    // let novos_participantes = vec![
    //     Participante {
    //         nome: "Carlos".to_string(),
    //         numero: "5511999990005".to_string(),
    //     },
    // ];
    // client.set_participantes(novos_participantes).await?;

    // Enviar mensagem
    // client.enviar_mensagem("120363XXX@g.us", "Teste!").await?;
    */

    println!("\n✅ Exemplo concluído com sucesso!");

    Ok(())
}
