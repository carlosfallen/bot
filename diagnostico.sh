#!/bin/bash

echo "🔍 DIAGNÓSTICO DO AMBIENTE"
echo "=========================="
echo ""

echo "📦 Node.js:"
node --version
echo ""

echo "📦 NPM:"
npm --version
echo ""

echo "📦 Versão do Baileys:"
npm list @whiskeysockets/baileys
echo ""

echo "🌐 Teste de conectividade WhatsApp:"
echo "Testando web.whatsapp.com..."
ping -c 3 web.whatsapp.com 2>&1 | grep -E "time=|loss"
echo ""

echo "🔌 Testando porta 443:"
timeout 3 bash -c 'cat < /dev/null > /dev/tcp/web.whatsapp.com/443' && echo "✅ Porta 443 OK" || echo "❌ Porta 443 BLOQUEADA"
echo ""

echo "🌍 Seu IP público:"
curl -s ifconfig.me
echo ""
echo ""

echo "📁 Conteúdo de auth_info:"
ls -la auth_info/ 2>&1
echo ""

echo "🔍 Processos Node rodando:"
ps aux | grep node | grep -v grep
echo ""

echo "=========================="
echo "✅ Diagnóstico completo!"