# 🚀 Império Lorde - WhatsApp Bot NLP

Sistema completo de atendimento automatizado via WhatsApp com NLP avançado, usando **Baileys**, **Bun**, **SolidJS** e **SQLite**.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Alpine](https://img.shields.io/badge/Alpine-3.22-0D597F)

## 📋 Índice

- [Características](#-características)
- [Arquitetura](#-arquitetura)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação Rápida (Alpine Linux)](#-instalação-rápida-alpine-linux)
- [Configuração Manual](#-configuração-manual)
- [Uso](#-uso)
- [API Endpoints](#-api-endpoints)
- [NLP & Qualificação de Leads](#-nlp--qualificação-de-leads)
- [Backup & Restore](#-backup--restore)
- [Cloudflare Tunnel](#-cloudflare-tunnel-opcional)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Características

### 🤖 Bot Inteligente
- ✅ **NLP Avançado** com Compromise + Natural
- ✅ **Análise de Sentimento** em tempo real
- ✅ **Extração de Entidades** (nome, empresa, orçamento, cidade, etc.)
- ✅ **Qualificação Automática de Leads** (quente/morno/frio)
- ✅ **Handoff Inteligente** para atendente humano
- ✅ **Horário Comercial Configurável**
- ✅ **Respostas Humanizadas** com variações

### 📱 WhatsApp Integration
- ✅ **Baileys** (sem API oficial, 100% gratuito)
- ✅ **QR Code** via interface web
- ✅ **Sessão Persistente**
- ✅ **Multi-sessão** suportado

### 💾 Dados & Persistência
- ✅ **SQLite** (leve e rápido)
- ✅ **Histórico completo** de conversas
- ✅ **CRM integrado** com leads
- ✅ **Backup automatizado**

### 🎨 Interface
- ✅ **Dashboard em tempo real** (WebSocket)
- ✅ **Visualização de conversas**
- ✅ **Analytics** (leads, mensagens, conversas ativas)
- ✅ **Responsivo** (mobile-friendly)

### 🐳 DevOps
- ✅ **Docker Compose** completo
- ✅ **Nginx** reverse proxy com rate limiting
- ✅ **Health checks** em todos os serviços
- ✅ **Logs estruturados** com Pino
- ✅ **Scripts Alpine** para fácil setup

---

## 🚀 Instalação Rápida (Alpine Linux)

### 1. Execute o Setup Automático

```bash
sh scripts/setup-alpine.sh
```

### 2. Configure o .env

```bash
nano .env
# Configure ADMIN_NUMBER, MIN_BUDGET_HOT, MIN_BUDGET_WARM
```

### 3. Reinicie

```bash
docker compose restart
```

### 4. Acesse o Dashboard

```
http://localhost
```

### 5. Escaneie o QR Code

✅ Pronto! O bot já está funcionando!

---

## 💻 Uso

```bash
# Ver status
docker compose ps

# Logs em tempo real
docker compose logs -f

# Health check
sh scripts/health-check.sh

# Backup
sh scripts/backup.sh

# Restore
sh scripts/restore.sh backups/imperio_backup_*.tar.gz
```

---

## ☁️ Cloudflare Tunnel (Opcional)

```bash
# Configure CLOUDFLARED_TOKEN no .env
docker compose -f docker-compose.yml -f docker-compose.cloudflare.yml up -d
```

---

**Desenvolvido com ❤️ para Império Lorde**