#!/usr/bin/env node

/**
 * Script para limpar autenticação e recomeçar
 */

import fs from 'fs';
import path from 'path';

const authPath = path.join(process.cwd(), 'auth_info');
const placarPath = path.join(process.cwd(), 'placar.json');
const dataPath = path.join(process.cwd(), 'data');
const mensagemCachePath = path.join(process.cwd(), 'mensagem-cache.json');

const args = process.argv.slice(2);

console.log('🧹 Limpeza de Dados\n');

// Limpar dados de votação
if (args.includes('--data')) {
  const dataFiles = [
    path.join(dataPath, 'reacoes.json'),
    path.join(dataPath, 'poll.json'),
    path.join(dataPath, 'users.json'),
    path.join(dataPath, 'mensagens.json'),
    path.join(dataPath, 'mensagem-cache.json'),
    mensagemCachePath
  ];

  for (const file of dataFiles) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      console.log(`✅ Arquivo ${path.basename(file)} removido`);
    }
  }
  console.log('\n✨ Limpeza de dados concluída!');
  console.log('💡 Agora rode: npm run dev\n');
  process.exit(0);
}

// Limpar auth_info
if (fs.existsSync(authPath)) {
  fs.rmSync(authPath, { recursive: true, force: true });
  console.log('✅ Pasta auth_info/ removida');
} else {
  console.log('ℹ️  Pasta auth_info/ não existe');
}

// Opcional: limpar placar
if (args.includes('--placar')) {
  if (fs.existsSync(placarPath)) {
    fs.unlinkSync(placarPath);
    console.log('✅ Arquivo placar.json removido');
  } else {
    console.log('ℹ️  Arquivo placar.json não existe');
  }
}

console.log('\n✨ Limpeza concluída!');
console.log('💡 Agora rode: npm run dev\n');
