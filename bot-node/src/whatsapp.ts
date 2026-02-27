import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  WASocket,
  proto,
  fetchLatestBaileysVersion,
  WAMessageContent,
  WAMessageKey,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from './config.js';
import { GruposManager, GrupoInfo } from './grupos.js';

export interface ConnectionStatus {
  connected: boolean;
  hasQR: boolean;
  qrCode: string | null;
}

type MessageHandler = (msg: proto.IWebMessageInfo) => Promise<void>;

/**
 * Cliente WhatsApp usando Baileys
 */
export class WhatsAppClient {
  private sock: WASocket | null = null;
  private isConnected: boolean = false;
  private qrCode: string | null = null;
  private messageHandlers: MessageHandler[] = [];
  private gruposManager: GruposManager;

  constructor(gruposManager?: GruposManager) {
    this.gruposManager = gruposManager || new GruposManager();
  }

  /**
   * Conecta ao WhatsApp
   */
  async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(config.caminhoAuth);

    // Fetch latest version of WA Web (with timeout)
    console.log('🔧 Buscando versão do WhatsApp Web...');
    let version: [number, number, number];
    let isLatest: boolean;
    
    try {
      const versionInfo = await Promise.race([
        fetchLatestBaileysVersion(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
      ]) as Awaited<ReturnType<typeof fetchLatestBaileysVersion>>;
      version = versionInfo.version;
      isLatest = versionInfo.isLatest;
      console.log('✅ Using WA version:', version.join('.'), isLatest ? '(latest)' : '');
    }catch (erro) {
      console.log('⚠️ Erro ao buscar versão, usando padrão');
      version = [2, 3000, 1015901307];
      isLatest = false;
    }
    
    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      // getMessage is REQUIRED by Baileys
      getMessage: async (_key: WAMessageKey): Promise<WAMessageContent | undefined> => {
        // Return empty message - in production you'd retrieve from database
        return proto.Message.fromObject({});
      },
    });

    console.log('✅ Socket criado, aguardando eventos...');

    // Use ev.process() pattern as recommended by Baileys
    this.sock.ev.process(async (events) => {
      // Connection update
      if (events['connection.update']) {
        const update = events['connection.update'];
        const { connection, lastDisconnect, qr } = update;

        // QR Code
        if (qr) {
          this.qrCode = qr;
          console.log('\n📱 Escaneie o QR Code no terminal abaixo:\n');
          qrcode.generate(qr, { small: true });
        }

        // Connected
        if (connection === 'open') {
          this.isConnected = true;
          this.qrCode = null;
          console.log('✅ WhatsApp conectado!');
          
          // List groups
          await this.listarGrupos();
        }

        // Disconnected
        if (connection === 'close') {
          this.isConnected = false;
          
          const shouldReconnect = 
            (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
          
          console.log('❌ Conexão fechada.');
          console.log('   Código:', (lastDisconnect?.error as Boom)?.output?.statusCode);
          console.log('   Motivo:', lastDisconnect?.error?.message || 'Desconhecido');
          console.log('   Reconectar:', shouldReconnect);
          
          if (shouldReconnect) {
            console.log('⏳ Reconectando em 5 segundos...\n');
            setTimeout(() => this.connect(), 5000);
          } else {
            console.log('🚫 Logout detectado. Não reconectando.');
            console.log('   Delete a pasta auth_info/ e inicie novamente.\n');
          }
        }
      }

      // Credentials updated
      if (events['creds.update']) {
        await saveCreds();
      }

      // Messages received
      if (events['messages.upsert']) {
        const { messages } = events['messages.upsert'];
        
        for (const msg of messages) {
          // ⚠️ FILTRO: Só processar/logar mensagens do grupo configurado
          const jid = msg.key?.remoteJid;
          
          // Skip messages from other groups and status broadcasts
          if (jid === 'status@broadcast') continue;
          if (config.grupoId && jid !== config.grupoId) continue;

          // Log message type for debugging
          const messageTypes = Object.keys(msg.message || {});
          if (messageTypes.length > 0 && !messageTypes.includes('conversation') && !messageTypes.includes('extendedTextMessage')) {
            console.log('\n📩 MESSAGE RECEIVED:');
            console.log('  Message types:', messageTypes);
            console.log('  Message content:', JSON.stringify(msg.message, null, 2));
          }
          
          // Ignore own messages
          if (msg.key.fromMe) continue;

          // Call all registered handlers
          for (const handler of this.messageHandlers) {
            try {
              await handler(msg);
            } catch (erro) {
              console.error('Erro no handler de mensagem:', erro);
            }
          }
        }
      }

      // Reactions received
      if (events['messages.reaction']) {
        const reactions = events['messages.reaction'];
        
        // ⚠️ FILTRO: Only process/log reactions from configured group
        const filteredReactions = reactions.filter(r => {
          const grupoReacao = r.reaction?.key?.remoteJid || r.key?.remoteJid;
          return !config.grupoId || grupoReacao === config.grupoId;
        });

        if (filteredReactions.length === 0) {
          continue; // Skip if no reactions from our group
        }

        console.log('\n🎯 REACTION EVENT RECEIVED:');
        console.log('Total reactions:', filteredReactions.length);
        
        for (const reactionEvent of filteredReactions) {
          console.log('\n📍 Reaction Event Structure:');
          console.log('  reactionEvent.key:', JSON.stringify(reactionEvent.key, null, 2));
          console.log('  reactionEvent.reaction:', JSON.stringify(reactionEvent.reaction, null, 2));
          
          // Log if it's own reaction (but don't skip it - we want to save it)
          if (reactionEvent.key.fromMe) {
            console.log('  ℹ️  Own reaction (will be saved but not counted as vote)');
          }

          // Transform the new reaction format to match what the bot expects
          // New format: { key: WAMessageKey (sender), reaction: proto.IReaction }
          // Old format: IWebMessageInfo with message.reactionMessage
          const fakeMessage: proto.IWebMessageInfo = {
            key: reactionEvent.key, // Who sent the reaction (has remoteJid/participant)
            message: {
              reactionMessage: {
                key: reactionEvent.reaction.key || reactionEvent.key, // Message being reacted to
                text: reactionEvent.reaction.text, // The emoji
                senderTimestampMs: reactionEvent.reaction.senderTimestampMs,
              },
            },
          };

          console.log('  📦 Transformed to fakeMessage:');
          console.log('    key:', JSON.stringify(fakeMessage.key, null, 2));
          console.log('    reactionMessage:', JSON.stringify(fakeMessage.message?.reactionMessage, null, 2));

          // Call all registered handlers
          for (const handler of this.messageHandlers) {
            try {
              await handler(fakeMessage);
            } catch (erro) {
              console.error('Erro no handler de reação:', erro);
            }
          }
        }
      }
    });
  }

  /**
   * Registra um handler para mensagens
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Lista todos os grupos
   */
  async listarGrupos(forcarAtualizacao: boolean = false): Promise<void> {
    if (!this.sock) return;

    // Verificar se já temos cache e não precisa atualizar
    if (!forcarAtualizacao && this.gruposManager.cacheExiste() && !this.gruposManager.precisaAtualizar()) {
      console.log('\n📋 Usando grupos em cache (ainda está atualizado)');
      this.gruposManager.listar();
      return;
    }

    try {
      console.log('🔄 Buscando grupos do WhatsApp...');
      const grupos = await this.sock.groupFetchAllParticipating();
      
      const gruposInfo: GrupoInfo[] = Object.values(grupos).map(g => ({
        id: g.id,
        nome: g.subject,
        participantesCount: g.participants?.length || 0,
        ultimaAtualizacao: new Date().toISOString(),
      }));

      // Salvar no cache
      this.gruposManager.salvar(gruposInfo);
      
      // Listar no console
      console.log('\n📋 Grupos disponíveis:');
      gruposInfo.forEach(g => {
        console.log(`  - ${g.nome}: ${g.id}`);
        console.log(`    (${g.participantesCount} participantes)`);
      });
      console.log('');
    } catch (erro) {
      console.error('Erro ao listar grupos:', erro);
      
      // Se falhou mas tem cache, usar o cache
      if (this.gruposManager.cacheExiste()) {
        console.log('⚠️  Usando cache de grupos (erro ao atualizar)');
        this.gruposManager.listar();
      }
    }
  }

  /**
   * Obtém participantes de um grupo
   */
  async obterParticipantesDoGrupo(grupoId: string): Promise<Array<{ nome: string; numero: string }>> {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp não está conectado');
    }

    try {
      const metadata = await this.sock.groupMetadata(grupoId);
      const participantes = [];

      console.log(`\n📋 Processando ${metadata.participants.length} participantes do grupo "${metadata.subject}"...\n`);

      for (const participant of metadata.participants) {
        const jid = participant.id;
        
        // Extrair número/ID (remove sufixos @s.whatsapp.net e @lid)
        let numero = jid.replace('@s.whatsapp.net', '').replace('@lid', '');
        
        // Tentar obter o melhor nome possível
        let nome = participant.notify || participant.verifiedName || numero;
        
        // Se é um contato LID (não tem número de telefone visível)
        const isLID = jid.includes('@lid');
        
        if (isLID) {
          // Para LIDs, o nome sempre será do metadata/notify
          console.log(`   👤 ${nome} (LID: ${numero.substring(0, 15)}...)`);
        } else {
          console.log(`   📱 ${nome} (${numero})`);
        }

        participantes.push({ 
          nome, 
          numero: jid // Guardar o JID completo para enviar mensagens
        });
      }

      console.log(`\n✅ Total: ${participantes.length} participantes\n`);
      return participantes;
    } catch (erro) {
      console.error('Erro ao obter participantes do grupo:', erro);
      throw erro;
    }
  }

  /**
   * Envia mensagem de texto
   */
  async enviarMensagem(jid: string, texto: string): Promise<any> {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp não está conectado');
    }
    return await this.sock.sendMessage(jid, { text: texto });
  }

  /**
   * Envia mensagem com menção a um usuário
   */
  async enviarMensagemComMencao(jid: string, texto: string, mencaoJid: string): Promise<any> {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp não está conectado');
    }
    return await this.sock.sendMessage(jid, { 
      text: texto,
      mentions: [mencaoJid]
    });
  }

  /**
   * Envia enquete
   */
  async enviarEnquete(
    jid: string,
    pergunta: string,
    opcoes: string[]
  ): Promise<any> {
    if (!this.isConnected || !this.sock) {
      throw new Error('WhatsApp não está conectado');
    }

    return await this.sock.sendMessage(jid, {
      poll: {
        name: pergunta,
        values: opcoes,
        selectableCount: 1,
      },
    });
  }

  /**
   * Retorna status da conexão
   */
  getStatus(): ConnectionStatus {
    return {
      connected: this.isConnected,
      hasQR: this.qrCode !== null,
      qrCode: this.qrCode,
    };
  }

  /**
   * Resolve número do WhatsApp para nome do participante
   */
  resolverNome(jid: string): string | null {
    // Procurar por JID completo (já que agora guardamos o JID completo)
    const participante = config.participantes.find(p => p.numero === jid);
    if (participante) return participante.nome;
    
    // Fallback: tentar encontrar removendo sufixos (compatibilidade)
    const numeroLimpo = jid.replace('@s.whatsapp.net', '').replace('@lid', '');
    const participanteAlt = config.participantes.find(p => 
      p.numero === numeroLimpo || 
      p.numero.replace('@s.whatsapp.net', '').replace('@lid', '') === numeroLimpo
    );
    return participanteAlt?.nome || null;
  }

  /**
   * Desconecta
   */
  async desconectar(): Promise<void> {
    if (this.sock) {
      await this.sock.logout();
      this.sock = null;
      this.isConnected = false;
    }
  }

  /**
   * Retorna o socket (para uso avançado)
   */
  getSock(): WASocket | null {
    return this.sock;
  }

  /**
   * Retorna o gerenciador de grupos
   */
  getGruposManager(): GruposManager {
    return this.gruposManager;
  }
}
