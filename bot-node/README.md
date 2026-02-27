# Queridômetro Bot - Node.js + TypeScript + Baileys

Bot do Queridômetro usando Baileys (TypeScript) com API REST para integração com Tauri.

## 🚀 Quick Start

### 1. Instalar dependências

```bash
cd bot-node
npm install
```

### 2. Configurar (opcional)

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite `.env` se necessário:

```env
GRUPO_ID=120363XXXXXXXXX@g.us
API_PORT=3000
API_HOST=127.0.0.1
```

### 3. Rodar em desenvolvimento

```bash
npm run dev
```

### 4. Escanear QR Code

Na primeira execução, o bot vai mostrar um QR code no terminal. Escaneie com seu WhatsApp.

### 5. Configurar Grupo

Após conectar, o bot vai listar todos os grupos. Copie o ID do grupo desejado e:

- Configure via `.env` com `GRUPO_ID=...`, ou
- Use a API: `POST /config/grupo` com `{ "grupoId": "..." }`

### 6. Build para produção

```bash
npm run build
npm start
```

## � Cache de Grupos

O bot salva automaticamente a lista de grupos do WhatsApp em `grupos.json` na primeira conexão. Esse cache:

- **Evita chamadas desnecessárias** à API do WhatsApp
- **Facilita configuração** - você pode copiar o ID do grupo diretamente do arquivo
- **Atualiza automaticamente** quando necessário (após 24 horas)
- **Pode ser atualizado manualmente** via API: `POST /grupos/refresh`

O arquivo `grupos.json` contém informações como:
```json
{
  "grupos": [
    {
      "id": "120363XXXXXXXXX@g.us",
      "nome": "Banco Master",
      "participantesCount": 15,
      "ultimaAtualizacao": "2026-02-24T10:30:00.000Z"
    }
  ],
  "ultimaAtualizacao": "2026-02-24T10:30:00.000Z"
}
```
## 📨 Persistência de Mensagens

O bot salva automaticamente as mensagens de votação em `mensagens.json` durante votações ativas. Isso permite:

- **Resistência a crashes** - Se o bot reiniciar, continua rastreando reações
- **Auditoria** - Histórico de quando cada mensagem foi enviada
- **Recuperação automática** - Restaura estado de votação ao iniciar

O arquivo `mensagens.json` contém:
```json
{
  "mensagens": [
    {
      "messageId": "3EB0ABCD1234...",
      "participanteNome": "João",
      "timestamp": "2026-02-24T20:00:15.123Z"
    }
  ],
  "dataAbertura": "2026-02-24T20:00:00.000Z",
  "grupoId": "120363XXXXXXXXX@g.us"
}
```

**Lifecycle:**
- ✅ Criado quando votação abre (`POST /votacao/abrir`)
- 📝 Atualizado a cada mensagem enviada
- 🔄 Restaurado automaticamente se bot reiniciar
- 🗑️ Removido quando votação fecha (`POST /votacao/fechar`)
- ⏰ Ignorado se for de um dia diferente
## 📊 Histórico de Reações

O bot registra **TODAS** as reações em `reacoes.json`, incluindo:
- ✅ Reações válidas (votos)
- ❌ Reações inválidas (emojis não aceitos, mensagens não-votação)
- 🤖 Suas próprias reações (do bot)

Isso permite análise completa de comportamento e auditoria.

O arquivo `reacoes.json` contém:
```json
{
  "reacoes": [
    {
      "timestamp": "2026-02-24T20:05:30.123Z",
      "messageId": "3EB0ABCD1234...",
      "participanteAvaliado": "João",
      "emoji": "❤️",
      "votanteJid": "5511999990002@s.whatsapp.net",
      "votanteNome": "Maria",
      "isPropriaReacao": false,
      "isValida": true,
      "grupoId": "120363XXXXXXXXX@g.us"
    }
  ],
  "dataInicio": "2026-02-24T20:00:00.000Z",
  "totalReacoes": 5
}
```

**Campos:**
- `isValida` - Se conta como voto (emoji válido + mensagem de votação + não-própria)
- `isPropriaReacao` - Se foi o bot que reagiu
- `votanteNome` - Nome identificado (ou `null` se não reconhecido)

**Lifecycle:**
- 📝 Salva TODA reação recebida em tempo real
- 🔄 Persiste entre reinicializações
- 🗑️ Limpo automaticamente no próximo dia
- 📊 Acessível via API para análises
## �📡 API REST

O bot expõe uma API REST na porta 3000 (padrão).

### Endpoints principais:

#### GET `/status`
Retorna status do bot e WhatsApp.

```json
{
  "whatsapp": { "connected": true, "hasQR": false, "qrCode": null },
  "bot": { "enquetesAtivas": 4, "participantesVotaram": ["João", "Maria"] },
  "config": { "grupoId": "...", "participantes": 4 }
}
```

#### GET `/qr`
Retorna QR code atual (se houver).

```json
{
  "qrCode": "2@base64encodedqrcode..."
}
```

#### GET `/placar`
Retorna placar e ranking.

```json
{
  "ranking": [
    { "nome": "João", "pontos": 10 },
    { "nome": "Maria", "pontos": 8 }
  ],
  "placar": { "João": 10, "Maria": 8 }
}
```

#### POST `/placar/resetar`
Zera o placar.

#### GET `/participantes`
Lista participantes configurados.

#### POST `/participantes`
Atualiza lista de participantes manualmente.

```json
{
  "participantes": [
    { "nome": "João", "numero": "5511999990001" },
    { "nome": "Maria", "numero": "5511999990002" }
  ]
}
```

#### GET `/participantes/grupo`
Busca participantes diretamente do grupo do WhatsApp.

```json
{
  "grupoId": "555192736282-1598897262@g.us",
  "participantes": [
    { "nome": "João da Silva", "numero": "5511999990001" },
    { "nome": "Maria Santos", "numero": "5511999990002" }
  ],
  "total": 2
}
```

#### POST `/participantes/sincronizar`
Sincroniza participantes automaticamente com o grupo do WhatsApp.

```json
{
  "message": "Participantes sincronizados com sucesso",
  "participantes": [...],
  "total": 15
}
```

#### POST `/votacao/abrir`
Abre votação manualmente (envia enquetes).

#### POST `/votacao/fechar`
Fecha votação manualmente (penaliza ausentes).

#### GET `/votacao/pendentes`
Lista quem ainda não votou.

```json
{
  "pendentes": ["Pedro", "Ana"]
}
```

#### GET `/config`
Retorna configuração completa.

#### POST `/config/grupo`
Define o grupo do queridômetro.

```json
{
  "grupoId": "120363XXXXXXXXX@g.us"
}
```

#### POST `/config/horarios`
Atualiza horários de abertura/fechamento.

```json
{
  "abertura": "0 20 * * *",
  "fechamento": "0 22 * * *"
}
```

#### GET `/grupos`
Lista todos os grupos em cache.

```json
{
  "grupos": [
    {
      "id": "120363XXXXXXXXX@g.us",
      "nome": "Banco Master",
      "participantesCount": 15,
      "ultimaAtualizacao": "2026-02-24T10:30:00.000Z"
    }
  ],
  "total": 1,
  "cache": {
    "grupos": 1,
    "ultimaAtualizacao": "2026-02-24T10:30:00.000Z",
    "idade": "2 horas"
  }
}
```

#### GET `/grupos/info`
Retorna informações sobre o cache de grupos.

```json
{
  "grupos": 5,
  "ultimaAtualizacao": "2026-02-24T10:30:00.000Z",
  "idade": "2 horas"
}
```

#### POST `/grupos/refresh`
Força atualização da lista de grupos do WhatsApp.

```json
{
  "message": "Grupos atualizados com sucesso",
  "grupos": [...],
  "total": 5
}
```

#### GET `/reacoes`
Lista todas as reações registradas do dia.

```json
{
  "reacoes": [
    {
      "timestamp": "2026-02-24T20:05:30.123Z",
      "messageId": "3EB0...",
      "participanteAvaliado": "João",
      "emoji": "❤️",
      "votanteNome": "Maria",
      "isPropriaReacao": false,
      "isValida": true
    }
  ],
  "info": {
    "totalReacoes": 15,
    "dataInicio": "2026-02-24T20:00:00.000Z",
    "temDados": true
  }
}
```

#### GET `/reacoes/estatisticas`
Retorna estatísticas das reações.

```json
{
  "total": 15,
  "validas": 12,
  "invalidas": 3,
  "proprias": 2,
  "porEmoji": {
    "❤️": 5,
    "🙂": 4,
    "💣": 3
  },
  "porParticipante": {
    "João": 4,
    "Maria": 5,
    "Pedro": 3
  }
}
```

#### GET `/reacoes/filtrar`
Filtra reações por critérios (query params: `participanteAvaliado`, `votanteNome`, `emoji`, `isValida`, `isPropriaReacao`).

```bash
GET /reacoes/filtrar?participanteAvaliado=João&isValida=true
```

```json
{
  "filtro": {
    "participanteAvaliado": "João",
    "isValida": true
  },
  "total": 4,
  "reacoes": [...]
}
```

#### POST `/reacoes/resetar`
Limpa o cache de reações.

```json
{
  "message": "Cache de reações resetado com sucesso"
}
```

#### POST `/mensagem`
Envia mensagem para um chat.

```json
{
  "jid": "120363XXXXXXXXX@g.us",
  "texto": "Mensagem de teste"
}
```

#### GET `/health`
Health check simples.

## 🤖 Comandos do Bot (no WhatsApp)

| Comando | Descrição |
|---------|-----------|
| `!placar` | Mostra ranking geral |
| `!pendentes` | Mostra quem não votou |
| `!abrirqueridometro` | Abre votação manual |
| `!resetarplacar` | Zera o placar |
| `!ajuda` | Lista comandos |

## ⚙️ Configuração

### Participantes

Edite em `src/config.ts`:

```typescript
participantes: [
  { nome: 'João', numero: '5511999990001' },
  { nome: 'Maria', numero: '5511999990002' },
  // ...
]
```

Ou use a API `POST /participantes`.

### Horários

Os horários usam formato cron:

- `0 20 * * *` = 20:00 todo dia
- `0 22 * * *` = 22:00 todo dia
- `30 19 * * *` = 19:30 todo dia

### Pontuação

```typescript
pontosParticipacao: 2,  // Quem vota ganha
pontosPenalidade: -1,   // Quem não vota perde
```

### Símbolos

```typescript
simbolos: [
  '❤️ Coração',
  '💀 Caveira',
  '⭐ Estrela',
  '😈 Capeta',
  '🤝 Parceiro',
]
```

## 🔧 Desenvolvimento

### Estrutura

```
bot-node/
├── src/
│   ├── index.ts          # Entry point
│   ├── config.ts         # Configuração
│   ├── whatsapp.ts       # Cliente Baileys
│   ├── placar.ts         # Gerenciador de placar
│   ├── queridometro.ts   # Lógica do bot
│   └── api.ts            # Servidor REST
├── dist/                 # Compilado (gerado)
├── auth_info/            # Autenticação WhatsApp
├── placar.json           # Placar persistido
├── package.json
└── tsconfig.json
```

### Scripts

```bash
npm run dev        # Desenvolvimento com hot reload
npm run build      # Compilar TypeScript
npm start          # Rodar produção
npm run clean      # Limpar dist/
npm run typecheck  # Verificar tipos sem compilar
```

### Type Safety

Todo código é tipado com TypeScript. Os tipos do Baileys são importados de `@whiskeysockets/baileys`.

## 🐳 Deploy

### PM2 (recomendado)

```bash
npm install -g pm2
npm run build
pm2 start dist/index.js --name queridometro
pm2 save
pm2 startup
```

### Docker (exemplo)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

### Variáveis de ambiente

```env
GRUPO_ID=120363XXXXXXXXX@g.us
API_PORT=3000
API_HOST=0.0.0.0
NODE_ENV=production
```

## 🔗 Integração com Tauri

O bot expõe API REST que pode ser consumida pelo Tauri usando `reqwest` (Rust).

Exemplo de cliente Rust virá na próxima implementação.

## 📝 Arquivos importantes

- `auth_info/` - Credenciais do WhatsApp (não commitar!)
- `placar.json` - Placar persistido (fazer backup!)
- `.env` - Configurações sensíveis (não commitar!)

## 🛟 Troubleshooting

### QR Code não aparece
- Verifique se a porta 3000 está livre
- Tente deletar `auth_info/` e reconectar

### Bot desconecta
- Normal se o WhatsApp Web for usado em outro dispositivo
- Bot reconecta automaticamente

### Enquetes não aparecem
- Verifique se `GRUPO_ID` está configurado corretamente
- Teste com `POST /votacao/abrir` via API

### Typescript errors
```bash
npm run typecheck
```

## 📄 Licença

MPL-2.0 - Same as parent project
