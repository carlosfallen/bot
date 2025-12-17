#!/usr/bin/env bun
// Script de migração do banco de dados

import { Database } from 'bun:sqlite';

const db = new Database('./data/imperio.db', { create: true });

console.log('🔄 Iniciando migração do banco de dados...');

try {
  // Verificar se colunas já existem
  const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('📊 Tabelas encontradas:', tables);

  // Adicionar coluna qualification na tabela leads (se não existir)
  try {
    db.exec('ALTER TABLE leads ADD COLUMN qualification TEXT DEFAULT "frio"');
    console.log('✅ Coluna qualification adicionada em leads');
  } catch (e: any) {
    if (e.message.includes('duplicate column')) {
      console.log('ℹ️  Coluna qualification já existe em leads');
    } else {
      throw e;
    }
  }

  // Adicionar coluna sentiment na tabela interactions (se não existir)
  try {
    db.exec('ALTER TABLE interactions ADD COLUMN sentiment TEXT');
    console.log('✅ Coluna sentiment adicionada em interactions');
  } catch (e: any) {
    if (e.message.includes('duplicate column')) {
      console.log('ℹ️  Coluna sentiment já existe em interactions');
    } else {
      throw e;
    }
  }

  // Adicionar coluna qualification na tabela sessions (se não existir)
  try {
    db.exec('ALTER TABLE sessions ADD COLUMN qualification TEXT DEFAULT "frio"');
    console.log('✅ Coluna qualification adicionada em sessions');
  } catch (e: any) {
    if (e.message.includes('duplicate column')) {
      console.log('ℹ️  Coluna qualification já existe em sessions');
    } else {
      throw e;
    }
  }

  // Verificar estrutura final
  const leadsInfo = db.query("PRAGMA table_info(leads)").all();
  const interactionsInfo = db.query("PRAGMA table_info(interactions)").all();
  const sessionsInfo = db.query("PRAGMA table_info(sessions)").all();

  console.log('\n📋 Estrutura final das tabelas:');
  console.log('\n🔹 leads:', leadsInfo.map((c: any) => c.name).join(', '));
  console.log('🔹 interactions:', interactionsInfo.map((c: any) => c.name).join(', '));
  console.log('🔹 sessions:', sessionsInfo.map((c: any) => c.name).join(', '));

  console.log('\n✅ Migração concluída com sucesso!');

} catch (error) {
  console.error('❌ Erro na migração:', error);
  process.exit(1);
}

db.close();
