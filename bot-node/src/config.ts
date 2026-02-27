export interface Participante {
    nome: string;
    numero: string;
}

export interface Config {
    // WhatsApp
    grupoId: string;

    // Participantes
    participantes: Participante[];

    // Horários (formato cron)
    horarioAbertura: string;
    horarioFechamento: string;

    // Pontuação
    pontosParticipacao: number;
    pontosPenalidade: number;

    // Arquivos
    caminhoAuth: string;
    caminhoPlacar: string;
    caminhoGrupos: string;
    caminhoMensagens: string;
    caminhoMensagemCache: string;
    caminhoPoll: string;
    caminhoReacoes: string;
    caminhoUsers: string;

    // API
    apiPort: number;
    apiHost: string;

    // Símbolos das enquetes
    simbolos: string[];
    simbolosDescricao: Record<string, string>;
}

export const config: Config = {
    // WhatsApp
    grupoId: process.env.GRUPO_ID || "", // Banco Master

    // Participantes (editável via API)
    participantes: [
        { nome: "João", numero: "5511999990001" },
        { nome: "Maria", numero: "5511999990002" },
        { nome: "Pedro", numero: "5511999990003" },
        { nome: "Ana", numero: "5511999990004" },
    ],

    // Horários (formato cron)
    horarioAbertura: "0 20 * * *", // 20:00 todo dia
    horarioFechamento: "0 22 * * *", // 22:00 todo dia

    // Pontuação
    pontosParticipacao: 2,
    pontosPenalidade: -1,

    // Arquivos
    caminhoAuth: "./auth_info",
    caminhoPlacar: "./data/placar.json",
    caminhoGrupos: "./data/grupos.json",
    caminhoMensagens: "./data/mensagens.json",
    caminhoMensagemCache: "./data/mensagem-cache.json",
    caminhoPoll: "./data/poll.json",
    caminhoReacoes: "./data/reacoes.json",
    caminhoUsers: "./data/users.json",

    // API
    apiPort: parseInt(process.env.API_PORT || "3000"),
    apiHost: process.env.API_HOST || "127.0.0.1",

    // Símbolos para reações (apenas emojis)
    simbolos: ["❤️", "🙂", "💣", "💔", "🪴", "🐍"],

    // Descrições dos símbolos
    simbolosDescricao: {
        "❤️": "Coração",
        "🙂": "Sorriso",
        "💣": "Bomba",
        "💔": "Coração Partido",
        "🪴": "Planta",
        "🐍": "Cobra",
    },
};
