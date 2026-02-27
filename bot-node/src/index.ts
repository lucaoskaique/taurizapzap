import 'dotenv/config';
import { WhatsAppClient } from './whatsapp.js';
import { PlacarManager } from './placar.js';
import { QueridometroBot } from './queridometro.js';
import { criarAPI } from './api.js';
import { config } from './config.js';
import { GruposManager } from './grupos.js';
import { MensagensManager } from './mensagens.js';
import { ReacoesManager } from './reacoes.js';
import { UsersManager } from './users.js';

async function main() {
  console.log('🚀 Iniciando Bot do Queridômetro\n');

  // Criar instâncias
  const gruposManager = new GruposManager();
  const mensagensManager = new MensagensManager();
  const reacoesManager = new ReacoesManager();
  const usersManager = new UsersManager();
  const whatsapp = new WhatsAppClient(gruposManager);
  const placar = new PlacarManager();
  const bot = new QueridometroBot(whatsapp, placar, mensagensManager, reacoesManager);

  // Verificar cache de grupos
  const cacheInfo = gruposManager.getInfo();
  if (cacheInfo.grupos > 0) {
    console.log(`📋 Cache de grupos encontrado: ${cacheInfo.grupos} grupos (${cacheInfo.idade} atrás)`);
    if (gruposManager.precisaAtualizar()) {
      console.log('⚠️  Cache desatualizado, será atualizado após conectar\n');
    } else {
      console.log('✅ Cache ainda está atualizado\n');
    }
  } else {
    console.log('📋 Nenhum cache de grupos encontrado, será criado após conectar\n');
  }

  // Conectar ao WhatsApp
  console.log('📱 Conectando ao WhatsApp...');
  console.log('💡 Se estiver conectando pela primeira vez, escaneie o QR code que aparecer.\n');
  
  try {
    await whatsapp.connect();
  } catch (erro) {
    console.error('❌ Erro ao conectar:', erro);
    console.log('\n🛠️  Troubleshooting:');
    console.log('   1. Apague a pasta auth_info/ e tente novamente: npm run clean');
    console.log('   2. Verifique se não há outro WhatsApp Web aberto');
    console.log('   3. Tente deslogar de todos os dispositivos no app\n');
    process.exit(1);
  }

  // Aguardar conexão (com timeout)
  console.log('⏳ Aguardando conexão...\n');
  
  const connected = await new Promise<boolean>((resolve) => {
    let attempts = 0;
    const maxAttempts = 60; // 60 segundos

    const interval = setInterval(() => {
      attempts++;
      const status = whatsapp.getStatus();
      
      if (status.connected) {
        clearInterval(interval);
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        resolve(false);
      } else if (attempts % 10 === 0) {
        console.log(`⏳ Ainda aguardando... (${attempts}s)`);
      }
    }, 1000);
  });

  if (!connected) {
    console.error('❌ Timeout: não foi possível conectar em 60 segundos');
    console.log('\n🛠️  Tente:');
    console.log('   1. Limpar autenticação: npm run clean');
    console.log('   2. Verificar o QR code no terminal');
    console.log('   3. Escanear o QR rapidamente com o WhatsApp\n');
    process.exit(1);
  }

  // Sincronizar participantes do grupo
  if (config.grupoId) {
    console.log('👥 Sincronizando participantes do grupo...');
    try {
      // Obter metadata do grupo
      const sock = whatsapp.getSock();
      if (sock) {
        const metadata = await sock.groupMetadata(config.grupoId);
        const grupoNome = metadata.subject;
        
        const participantes = await whatsapp.obterParticipantesDoGrupo(config.grupoId);
        config.participantes = participantes;
        
        // Salvar em users.json
        usersManager.atualizarUsuarios(config.grupoId, grupoNome, participantes);
        
        console.log(`✅ ${participantes.length} participantes sincronizados:`);
        participantes.forEach(p => console.log(`   - ${p.nome} (${p.numero})`));
        console.log('');
      } else {
        console.warn('⚠️  Socket não disponível');
      }
    } catch (erro) {
      console.warn('⚠️  Erro ao sincronizar participantes:', erro instanceof Error ? erro.message : String(erro));
      console.log('   Usando participantes do config padrão\n');
    }
  }

  // Iniciar bot
  bot.iniciar();

  // Criar e iniciar API
  const app = criarAPI(whatsapp, placar, bot, reacoesManager, usersManager);
  
  const server = app.listen(config.apiPort, config.apiHost, () => {
    console.log(`\n🌐 API rodando em http://${config.apiHost}:${config.apiPort}`);
    console.log('\n✅ Bot totalmente iniciado e pronto!');
    console.log('\n📋 Endpoints disponíveis:');
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/status`);
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/qr`);
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/placar`);
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/grupos`);
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/users`);
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/reacoes`);
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/reacoes/estatisticas`);
    console.log(`  POST http://${config.apiHost}:${config.apiPort}/grupos/refresh`);
    console.log(`  POST http://${config.apiHost}:${config.apiPort}/votacao/abrir`);
    console.log(`  POST http://${config.apiHost}:${config.apiPort}/votacao/fechar`);
    console.log(`  GET  http://${config.apiHost}:${config.apiPort}/config`);
    console.log('\n💡 Use Ctrl+C para parar o bot\n');
  });

  // Graceful shutdown
  let isShuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
      console.log('⚠️  Shutdown já em andamento...');
      return;
    }

    isShuttingDown = true;
    console.log(`\n\n👋 Sinal ${signal} recebido. Encerrando graciosamente...`);

    // Timeout de segurança (força encerramento após 10 segundos)
    const forceShutdownTimer = setTimeout(() => {
      console.error('⏰ Timeout: forçando encerramento imediato');
      process.exit(1);
    }, 10000);

    try {
      // 1. Parar de aceitar novas conexões HTTP
      console.log('🌐 Fechando servidor HTTP...');
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            console.error('   ❌ Erro ao fechar servidor:', err.message);
            reject(err);
          } else {
            console.log('   ✅ Servidor HTTP fechado');
            resolve();
          }
        });
      });

      // 2. Parar bot (parar timers, jobs, etc)
      console.log('🤖 Parando bot...');
      bot.parar();
      console.log('   ✅ Bot parado');

      // 3. Desconectar do WhatsApp
      console.log('📱 Desconectando do WhatsApp...');
      await whatsapp.desconectar();
      console.log('   ✅ WhatsApp desconectado');

      // 4. Salvar dados finais (se necessário)
      console.log('💾 Salvando dados finais...');
      // Adicione aqui salvamento de dados se necessário
      console.log('   ✅ Dados salvos');

      clearTimeout(forceShutdownTimer);
      console.log('\n✅ Encerramento concluído com sucesso');
      process.exit(0);
    } catch (erro) {
      clearTimeout(forceShutdownTimer);
      console.error('\n❌ Erro durante encerramento:', erro);
      process.exit(1);
    }
  };

  // Registrar handlers para sinais de shutdown
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handler para erros não tratados
  process.on('uncaughtException', (erro) => {
    console.error('\n❌ Exceção não tratada:', erro);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (motivo) => {
    console.error('\n❌ Promise rejeitada não tratada:', motivo);
    gracefulShutdown('UNHANDLED_REJECTION');
  });
}

// Executar
main().catch((erro) => {
  console.error('❌ Erro fatal:', erro);
  process.exit(1);
});
