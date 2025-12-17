# ⚡ Quick Start - Império Lorde Bot

Guia ultra-rápido para colocar o bot no ar em **menos de 5 minutos**.

---

## 🚀 Instalação Express

### Opção 1: Alpine Linux (Recomendado)

```bash
# 1. Setup automático (faz tudo)
sh scripts/setup-alpine.sh

# 2. Editar .env (OBRIGATÓRIO)
nano .env
# Configure:
# - ADMIN_NUMBER=5585999999999  (seu WhatsApp)

# 3. Reiniciar
docker compose restart

# 4. Abrir browser
# http://localhost (ou http://SEU_IP)

# 5. Escanear QR Code com WhatsApp
# WhatsApp → Aparelhos Conectados → Conectar Aparelho
```

✅ **Pronto! Bot funcionando!**

---

### Opção 2: Outras Distros Linux

```bash
# 1. Instalar Docker
curl -fsSL https://get.docker.com | sh
systemctl start docker
systemctl enable docker

# 2. Copiar e configurar .env
cp .env.example .env
nano .env  # Configure ADMIN_NUMBER

# 3. Build e start
docker compose build
docker compose up -d

# 4. Acessar
# http://localhost
```

---

### Opção 3: Desenvolvimento Local (sem Docker)

```bash
# 1. Instalar Bun
curl -fsSL https://bun.sh/install | bash

# 2. Instalar dependências
bun install

# 3. Configurar .env
cp .env.example .env
nano .env

# 4. Iniciar
bun run dev

# 5. Acessar
# http://localhost:3000
```

---

## ⚙️ Configuração Mínima (.env)

```env
# Essencial (OBRIGATÓRIO)
ADMIN_NUMBER=5585999999999

# Recomendado
MIN_BUDGET_HOT=3000
MIN_BUDGET_WARM=1000
WORK_HOURS_START=08:00
WORK_HOURS_END=18:00
```

---

## ✅ Verificar Instalação

```bash
# Health check
sh scripts/health-check.sh

# Ver logs
docker compose logs -f

# Status containers
docker compose ps
```

**Esperado:**
```
✓ Docker está rodando
✓ App container: healthy
✓ Nginx container: healthy
✓ API Health endpoint respondendo
✓ Banco de dados: XXX KB
```

---

## 📱 Conectar WhatsApp

1. Abra **http://localhost** no navegador
2. Aguarde QR Code aparecer (10-30 segundos)
3. No celular:
   - Abra WhatsApp
   - Menu (⋮) → **Aparelhos conectados**
   - **Conectar um aparelho**
   - Escaneie o QR Code
4. Aguarde "WhatsApp Conectado!" no dashboard

---

## 🧪 Testar Bot

Envie mensagem para o número do WhatsApp conectado:

```
Você: Oi

Bot: Oi! Tudo bem? 👋
     Sou da Império Lorde, agência completa de marketing digital.
     Como posso te ajudar?

Você: preciso de tráfego pago

Bot: Show! Tráfego pago é nosso forte.
     Qual seu nome?
```

✅ **Funcionando!**

---

## 📊 Dashboard

Acesse **http://localhost** para ver:

- 📱 Status da conexão WhatsApp
- 📊 Estatísticas (leads, mensagens, conversas ativas)
- 💬 Lista de conversas
- 📨 Chat em tempo real
- 🎯 Análise NLP (intent, confidence, sentiment)

---

## 🔧 Comandos Úteis

```bash
# Ver logs em tempo real
docker compose logs -f

# Ver apenas logs do app
docker compose logs -f app

# Reiniciar tudo
docker compose restart

# Parar tudo
docker compose down

# Rebuild completo
docker compose down
docker compose build --no-cache
docker compose up -d

# Backup
sh scripts/backup.sh

# Health check
sh scripts/health-check.sh
```

---

## 🐛 Problemas Comuns

### QR Code não aparece

```bash
# Ver logs do app
docker compose logs app

# Se erro de permissão
chmod 755 sessions data logs

# Se container não está rodando
docker compose up -d
```

### WhatsApp desconecta

```bash
# Remover sessão antiga
rm -rf sessions/*

# Reiniciar app
docker compose restart app

# Escanear QR novamente
```

### Container não inicia

```bash
# Ver erro exato
docker compose logs app

# Rebuild
docker compose down
docker compose build
docker compose up -d
```

### Permissão negada

```bash
# Ajustar permissões
chmod 755 data sessions logs scripts
chmod 600 .env
chmod +x scripts/*.sh
```

---

## 📚 Próximos Passos

1. ✅ **Personalizar templates** de mensagens
   - Edite `src/server/db.ts` função `insertDefaultTemplates`
   - Rebuild: `docker compose restart`

2. ✅ **Configurar backup automático**
   ```bash
   crontab -e
   # Adicionar:
   0 3 * * * cd /caminho/projeto && sh scripts/backup.sh
   ```

3. ✅ **Expor na internet** (opcional)
   - Ver [README.md](README.md) seção "Cloudflare Tunnel"

4. ✅ **Monitorar logs**
   ```bash
   tail -f logs/*.log
   docker compose logs -f
   ```

5. ✅ **Ler documentação completa**
   - [README.md](README.md) - Documentação completa
   - [FLUXO.md](FLUXO.md) - Fluxo de conversa detalhado
   - [MIGRACAO.md](MIGRACAO.md) - Changelog v2.0

---

## 🆘 Precisa de Ajuda?

1. Execute `sh scripts/health-check.sh`
2. Veja `docker compose logs -f`
3. Consulte [README.md](README.md) seção Troubleshooting
4. Veja issues conhecidos em [MIGRACAO.md](MIGRACAO.md)

---

## ✅ Checklist de Início

- [ ] Alpine Linux instalado (ou outra distro)
- [ ] Docker rodando
- [ ] Projeto clonado
- [ ] `.env` configurado com ADMIN_NUMBER
- [ ] Containers buildados e rodando
- [ ] Health check OK
- [ ] Dashboard acessível
- [ ] QR Code escaneado
- [ ] Teste de mensagem enviado e respondido

---

**🎉 Tudo pronto! Seu bot está funcionando!**

**Agora você tem:**
- ✅ WhatsApp Bot inteligente com NLP
- ✅ Qualificação automática de leads
- ✅ Handoff inteligente para humanos
- ✅ Dashboard em tempo real
- ✅ Backup e restore
- ✅ Production-ready

**Automatize, escale, conquiste!** 🚀

---

_Desenvolvido com ❤️ para Império Lorde_
