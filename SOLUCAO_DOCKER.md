# 🔧 SOLUÇÃO: SQLiteError - unable to open database file

## ❌ Problema

```
SQLiteError: unable to open database file
errno: 14
code: "SQLITE_CANTOPEN"
```

**Causa:** Os diretórios `data`, `sessions` e `logs` não existem no **host** antes de montar os volumes do Docker.

---

## ✅ SOLUÇÃO RÁPIDA

Execute o script de inicialização:

```bash
./docker-start.sh
```

Ou manualmente:

```bash
# 1. Criar diretórios
mkdir -p data sessions logs

# 2. Ajustar permissões (IMPORTANTE!)
chmod 777 data sessions logs

# 3. Criar .env
cp .env.example .env
nano .env  # Configure ADMIN_NUMBER

# 4. Limpar e rebuild
docker-compose down
docker-compose build --no-cache

# 5. Iniciar
docker-compose up
```

---

## 🔍 Por Que Aconteceu?

O Docker monta volumes do host (`./data`, `./sessions`, `./logs`) **antes** do container criar os diretórios.

Se os diretórios não existem no host:
1. Docker cria como **root**
2. Container roda como usuário **imperio** (não-root)
3. Usuário **imperio** não tem permissão para escrever
4. SQLite falha ao criar o arquivo de banco

---

## 🎯 O Que Foi Corrigido

### 1. Dockerfile

**Antes:**
```dockerfile
RUN mkdir -p /app/data /app/sessions /app/logs && \
    chown -R imperio:imperio /app
USER imperio
```

**Depois:**
```dockerfile
RUN chown -R imperio:imperio /app
USER imperio
RUN mkdir -p /app/data /app/sessions /app/logs
```

Agora os diretórios são criados **como usuário imperio**.

### 2. Script de Inicialização

Criado `docker-start.sh` que:
- ✅ Cria diretórios no host
- ✅ Ajusta permissões (777)
- ✅ Cria .env
- ✅ Rebuild e inicia

---

## 🚀 Testando Agora

```bash
# Usar o script (RECOMENDADO)
./docker-start.sh
```

Ou passo a passo:

```bash
# 1. Parar tudo
docker-compose down

# 2. Limpar (se necessário)
sudo rm -rf data sessions logs

# 3. Criar diretórios com permissões corretas
mkdir -p data sessions logs
chmod 777 data sessions logs

# 4. Rebuild
docker-compose build --no-cache

# 5. Iniciar
docker-compose up
```

---

## ✅ Logs de Sucesso

Você deve ver:

```
imperio-app    | ✅ Database inicializado
imperio-app    | ✅ WhatsApp inicializado
imperio-app    | 🌐 Servidor rodando em http://localhost:3210
imperio-app    | 📱 QR Code gerado (tentativa 1/3)
```

---

## 🐛 Troubleshooting

### Ainda dá erro de permissão?

```bash
# Verificar permissões
ls -la data sessions logs

# Deve mostrar:
# drwxrwxrwx ... data
# drwxrwxrwx ... sessions
# drwxrwxrwx ... logs

# Se não, corrigir:
sudo chmod 777 data sessions logs
```

### Container não inicia?

```bash
# Ver logs detalhados
docker-compose logs imperio-app

# Verificar se diretórios existem
ls -la | grep -E "data|sessions|logs"
```

### Banco de dados corrompido?

```bash
# Limpar banco e recomeçar
sudo rm -rf data/*
docker-compose restart imperio-app
```

---

## 📁 Estrutura Correta

Depois de executar, você deve ter:

```
imperio-baileys-nlp/
├── data/              # ← Criado com chmod 777
│   └── imperio.db     # ← SQLite cria automaticamente
├── sessions/          # ← Criado com chmod 777
│   └── creds.json     # ← Baileys cria ao conectar
├── logs/              # ← Criado com chmod 777
├── docker-compose.yml
├── Dockerfile
├── docker-start.sh    # ← NOVO! Use este script
└── ...
```

---

## 💡 Dica: Sempre Use o Script

De agora em diante, para iniciar o Docker:

```bash
./docker-start.sh
```

Ele garante que:
1. Diretórios existem
2. Permissões corretas
3. .env configurado
4. Build limpo
5. Containers iniciados

---

## 🎉 Pronto!

Agora o bot deve iniciar sem erros!

Acesse: http://localhost:3210

---

**Desenvolvido com ❤️ para Império Lorde**

Problema SQLite resolvido! ✅
