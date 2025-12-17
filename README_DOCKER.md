# 🐳 Guia Completo Docker - Império Lorde Bot

## 🚀 Início Rápido (3 Comandos)

```bash
./docker-start.sh
```

Pronto! Acesse: http://localhost:3210

---

## 📋 Pré-requisitos

- Docker instalado
- Docker Compose instalado
- Portas 80, 443 e 3210 disponíveis

---

## 🔧 Instalação Completa

### Passo 1: Preparar Ambiente

```bash
# 1. Criar diretórios
mkdir -p data sessions logs

# 2. Ajustar permissões
chmod 777 data sessions logs

# 3. Criar .env
cp .env.example .env
nano .env  # Configure ADMIN_NUMBER
```

### Passo 2: Configurar .env

Edite `.env` e configure:

```env
# Número do admin (com código do país, SEM +)
ADMIN_NUMBER=5585999999999

# Horário de funcionamento
WORK_HOURS_START=08:00
WORK_HOURS_END=18:00
WORK_DAYS=1,2,3,4,5

# Portas
APP_PORT=3210
HTTP_PORT=80
HTTPS_PORT=443
```

### Passo 3: Iniciar

**Opção A - Script automático (RECOMENDADO):**

```bash
./docker-start.sh
```

**Opção B - Manual:**

```bash
# Build
docker-compose build --no-cache

# Iniciar
docker-compose up

# Ou em background
docker-compose up -d
```

---

## 🎯 Verificação

### Checklist de Sucesso

Verifique os logs:

```bash
docker-compose logs -f imperio-app
```

Deve aparecer:

```
✅ Database inicializado
✅ WhatsApp inicializado
🌐 Servidor rodando em http://localhost:3210
📱 QR Code gerado (tentativa 1/3)
```

### Teste os Endpoints

```bash
# Health check
curl http://localhost:3210/api/health

# Deve retornar:
# {"status":"ok","uptime":123}

# Status WhatsApp
curl http://localhost:3210/api/status

# Deve retornar:
# {"status":"connecting","qrCode":null}
```

---

## 📱 Conectar WhatsApp

1. **Acesse:** http://localhost:3210
2. **Veja o QR Code** na interface
3. **Abra WhatsApp no celular:**
   - Menu (3 pontos)
   - Aparelhos conectados
   - Conectar um aparelho
   - **Escaneie o QR Code**
4. **Aguarde:** "✅ WhatsApp conectado"

---

## 🛠️ Comandos Úteis

### Gerenciamento

```bash
# Iniciar
docker-compose up

# Iniciar em background
docker-compose up -d

# Parar
docker-compose down

# Parar e remover volumes
docker-compose down -v

# Reiniciar
docker-compose restart

# Ver logs
docker-compose logs -f imperio-app

# Ver logs nginx
docker-compose logs -f imperio-nginx
```

### Debugging

```bash
# Entrar no container
docker-compose exec imperio-app sh

# Ver processos
docker-compose ps

# Inspecionar container
docker inspect imperio-app

# Ver uso de recursos
docker stats imperio-app
```

### Limpeza

```bash
# Limpar sessões (desconecta WhatsApp)
docker-compose down
sudo rm -rf sessions/*
docker-compose up

# Limpar banco de dados
sudo rm -rf data/*
docker-compose restart

# Limpar tudo
docker-compose down -v
sudo rm -rf data sessions logs
docker system prune -af
```

---

## 🐛 Troubleshooting

### Erro: "SQLiteError: unable to open database file"

**Solução:**

```bash
# 1. Parar containers
docker-compose down

# 2. Criar diretórios com permissões
mkdir -p data sessions logs
chmod 777 data sessions logs

# 3. Rebuild e iniciar
docker-compose build --no-cache
docker-compose up
```

**Leia:** [SOLUCAO_DOCKER.md](SOLUCAO_DOCKER.md)

---

### Erro: "Conflito 515"

**Solução:**

```bash
# Limpar sessões
docker-compose down
sudo rm -rf sessions/*
docker-compose up
```

**Leia:** [COMO_CONECTAR_WHATSAPP.md](COMO_CONECTAR_WHATSAPP.md)

---

### Porta 3210 já em uso

**Verificar:**

```bash
sudo lsof -i :3210
```

**Solução:**

```bash
# Matar processo
sudo kill -9 <PID>

# Ou mudar porta no .env
echo "APP_PORT=3220" >> .env
docker-compose down
docker-compose up
```

---

### Container não inicia

**Verificar logs:**

```bash
docker-compose logs imperio-app
```

**Rebuild completo:**

```bash
docker-compose down -v
sudo rm -rf data sessions logs
./docker-start.sh
```

---

### Nginx não funciona

**Verificar configuração:**

```bash
docker-compose logs imperio-nginx
```

**Verificar arquivos:**

```bash
ls -la nginx/nginx.conf
ls -la nginx/conf.d/
```

**Se não existir, criar básico:**

```bash
mkdir -p nginx/conf.d
cat > nginx/conf.d/default.conf << 'NGINX'
server {
    listen 80;
    
    location / {
        proxy_pass http://imperio-app:3210;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /health {
        proxy_pass http://imperio-app:3210/api/health;
    }
}
NGINX
```

---

## 📊 Monitoramento

### Logs em Tempo Real

```bash
# Todos os containers
docker-compose logs -f

# Apenas app
docker-compose logs -f imperio-app

# Apenas nginx
docker-compose logs -f imperio-nginx

# Filtrar por palavra
docker-compose logs -f imperio-app | grep "📨"

# Ver últimas 100 linhas
docker-compose logs --tail=100 imperio-app
```

### Métricas

```bash
# Uso de recursos
docker stats imperio-app

# Espaço em disco
docker system df

# Volumes
docker volume ls
```

---

## 🔐 Produção

### SSL/HTTPS (Opcional)

1. **Adicionar certificados:**

```bash
mkdir -p nginx/ssl
# Copiar certificados para nginx/ssl/
```

2. **Atualizar nginx/conf.d/default.conf:**

```nginx
server {
    listen 443 ssl;
    server_name seu-dominio.com;
    
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    
    location / {
        proxy_pass http://imperio-app:3210;
        # ... resto da configuração
    }
}

server {
    listen 80;
    server_name seu-dominio.com;
    return 301 https://$server_name$request_uri;
}
```

### Backup

```bash
# Backup do banco
docker-compose exec imperio-app sh -c "cat /app/data/imperio.db" > backup-$(date +%Y%m%d).db

# Backup das sessões
tar -czf sessions-backup-$(date +%Y%m%d).tar.gz sessions/

# Backup completo
tar -czf imperio-backup-$(date +%Y%m%d).tar.gz data/ sessions/ logs/ .env
```

### Restore

```bash
# Restaurar banco
docker-compose down
cat backup-20241217.db > data/imperio.db
docker-compose up -d

# Restaurar sessões
tar -xzf sessions-backup-20241217.tar.gz
docker-compose restart
```

---

## 🔄 Atualizações

### Atualizar Código

```bash
# 1. Parar containers
docker-compose down

# 2. Puxar updates (se usando git)
git pull

# 3. Rebuild
docker-compose build --no-cache

# 4. Iniciar
docker-compose up -d
```

### Atualizar Dependências

```bash
# 1. Editar package.json

# 2. Rebuild
docker-compose build --no-cache

# 3. Reiniciar
docker-compose up -d
```

---

## 📚 Estrutura dos Containers

### imperio-app

- **Imagem:** oven/bun:1.1-debian
- **Porta:** 3210
- **Volumes:** data, sessions, logs
- **Healthcheck:** http://localhost:3210/api/health

### imperio-nginx

- **Imagem:** nginx:alpine
- **Portas:** 80, 443
- **Configuração:** nginx/conf.d/
- **Logs:** logs/nginx/

---

## 🎯 Próximos Passos

Depois de conectar:

1. **Teste mensagens** enviando para o número conectado
2. **Monitore logs** com `docker-compose logs -f`
3. **Configure horários** no `.env`
4. **Personalize templates** (veja documentação)
5. **Configure backup** automático

---

## 📞 Suporte

**Problemas?**

1. Leia [SOLUCAO_DOCKER.md](SOLUCAO_DOCKER.md)
2. Leia [COMO_CONECTAR_WHATSAPP.md](COMO_CONECTAR_WHATSAPP.md)
3. Verifique logs: `docker-compose logs -f imperio-app`
4. Teste API: `curl http://localhost:3210/api/health`

---

**Desenvolvido com ❤️ para Império Lorde**

Docker Stack: Bun + Baileys + SolidJS + Nginx ✅
