// src/components/QRCodeDisplay.tsx - VERSÃO COMPLETA COM CONTROLES

import { createSignal, createEffect, Show } from "solid-js";

interface QRCodeDisplayProps {
  connected: boolean;
}

export default function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [qrCode, setQrCode] = createSignal<string>('');
  const [loading, setLoading] = createSignal(true);
  const [mode, setMode] = createSignal<'qr' | 'pairing'>('qr');
  const [phoneNumber, setPhoneNumber] = createSignal('');
  const [pairingCode, setPairingCode] = createSignal('');
  const [requesting, setRequesting] = createSignal(false);

  createEffect(() => {
    if (!props.connected && mode() === 'qr') {
      loadQRCode();
      const interval = setInterval(loadQRCode, 30000);
      return () => clearInterval(interval);
    }
  });

  const loadQRCode = async () => {
    try {
      const response = await fetch('/api/qr');
      const data = await response.json();
      if (data.qr) {
        setQrCode(data.qr);
      }
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar QR Code:', error);
      setLoading(false);
    }
  };

  const requestPairingCode = async () => {
    if (!phoneNumber().trim() || phoneNumber().length < 10) {
      alert('Digite um número válido (ex: 5585999999999)');
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch('/api/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber() })
      });

      const data = await response.json();
      
      if (data.success && data.code) {
        setPairingCode(data.code);
        alert(`Código de pareamento: ${data.code}\n\nDigite este código no WhatsApp:\nConfigurações > Aparelhos conectados > Conectar aparelho > Digite o código`);
      } else {
        alert('Erro ao gerar código: ' + (data.error || 'Desconhecido'));
      }
    } catch (error) {
      console.error('Erro ao solicitar pairing code:', error);
      alert('Erro ao solicitar código de pareamento');
    } finally {
      setRequesting(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Deseja realmente desconectar o WhatsApp?')) return;

    try {
      const response = await fetch('/api/disconnect', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        alert('WhatsApp desconectado com sucesso!');
        window.location.reload();
      }
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      alert('Erro ao desconectar');
    }
  };

  const restart = async () => {
    if (!confirm('Deseja reiniciar a conexão? Isso irá limpar a sessão atual.')) return;

    try {
      const response = await fetch('/api/restart', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        alert('Conexão reiniciada! Aguarde o novo QR Code...');
        setQrCode('');
        setLoading(true);
        setPairingCode('');
        setTimeout(loadQRCode, 3000);
      }
    } catch (error) {
      console.error('Erro ao reiniciar:', error);
      alert('Erro ao reiniciar conexão');
    }
  };

  return (
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-gray-800">📱 WhatsApp</h2>
        
        <Show when={props.connected}>
          <div class="flex gap-2">
            <button
              onClick={disconnect}
              class="text-xs px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Desconectar
            </button>
            <button
              onClick={restart}
              class="text-xs px-3 py-1 bg-orange-500 text-white rounded hover:bg-orange-600"
            >
              Reiniciar
            </button>
          </div>
        </Show>
      </div>

      <Show when={props.connected}>
        <div class="text-center py-8">
          <div class="text-6xl mb-4">✅</div>
          <div class="text-green-600 font-bold text-lg">Conectado!</div>
          <div class="text-gray-600 text-sm mt-2">WhatsApp está pronto para uso</div>
        </div>
      </Show>

      <Show when={!props.connected}>
        <div class="space-y-4">
          {/* Tabs de Modo */}
          <div class="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setMode('qr')}
              class={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                mode() === 'qr'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              QR Code
            </button>
            <button
              onClick={() => setMode('pairing')}
              class={`px-4 py-2 font-medium text-sm border-b-2 transition ${
                mode() === 'pairing'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Código de Pareamento
            </button>
          </div>

          {/* QR Code Mode */}
          <Show when={mode() === 'qr'}>
            <Show when={loading()}>
              <div class="text-center py-8">
                <div class="text-4xl mb-4">⏳</div>
                <div class="text-gray-600">Gerando QR Code...</div>
              </div>
            </Show>

            <Show when={!loading() && qrCode()}>
              <div class="space-y-4">
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <img
                    src={qrCode()}
                    alt="QR Code WhatsApp"
                    class="w-full max-w-[250px] mx-auto"
                  />
                </div>

                <div class="text-sm text-gray-600 space-y-2">
                  <p class="font-medium text-gray-800">📲 Como conectar:</p>
                  <ol class="list-decimal list-inside space-y-1 text-xs">
                    <li>Abra o WhatsApp no seu celular</li>
                    <li>Toque em <strong>Mais opções</strong> ou <strong>Configurações</strong></li>
                    <li>Toque em <strong>Aparelhos conectados</strong></li>
                    <li>Toque em <strong>Conectar um aparelho</strong></li>
                    <li>Aponte seu celular para esta tela para escanear o QR Code</li>
                  </ol>
                </div>

                <button
                  onClick={loadQRCode}
                  class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  🔄 Atualizar QR Code
                </button>
              </div>
            </Show>

            <Show when={!loading() && !qrCode()}>
              <div class="text-center py-8">
                <div class="text-4xl mb-4">⚠️</div>
                <div class="text-yellow-600 font-medium">Aguardando QR Code</div>
                <div class="text-gray-600 text-sm mt-2">Inicie o servidor WhatsApp</div>
                <button
                  onClick={loadQRCode}
                  class="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  Tentar Novamente
                </button>
              </div>
            </Show>
          </Show>

          {/* Pairing Code Mode */}
          <Show when={mode() === 'pairing'}>
            <div class="space-y-4">
              <div class="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                <p class="font-medium text-blue-800 mb-2">💡 Como funciona:</p>
                <ol class="list-decimal list-inside space-y-1 text-xs">
                  <li>Digite seu número de WhatsApp abaixo</li>
                  <li>Clique em "Gerar Código"</li>
                  <li>No WhatsApp: Aparelhos conectados → Conectar aparelho → Digite o código</li>
                </ol>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-2">
                  Número do WhatsApp (com DDI)
                </label>
                <input
                  type="text"
                  value={phoneNumber()}
                  onInput={(e) => setPhoneNumber(e.currentTarget.value)}
                  placeholder="5585999999999"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  disabled={requesting()}
                />
                <div class="text-xs text-gray-500 mt-1">
                  Exemplo: 55 (código do país) + 85 (DDD) + 999999999
                </div>
              </div>

              <button
                onClick={requestPairingCode}
                disabled={requesting() || !phoneNumber().trim()}
                class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {requesting() ? '⏳ Gerando...' : '🔑 Gerar Código'}
              </button>

              <Show when={pairingCode()}>
                <div class="bg-green-50 border-2 border-green-500 rounded-lg p-4 text-center">
                  <div class="text-sm text-green-800 font-medium mb-2">
                    ✅ Código gerado com sucesso!
                  </div>
                  <div class="text-3xl font-bold text-green-600 tracking-widest mb-2">
                    {pairingCode()}
                  </div>
                  <div class="text-xs text-green-700">
                    Digite este código no WhatsApp em até 60 segundos
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          {/* Botão Reiniciar (sempre visível quando desconectado) */}
          <div class="pt-4 border-t border-gray-200">
            <button
              onClick={restart}
              class="w-full px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm font-medium"
            >
              🔄 Reiniciar Conexão (Limpar Sessão)
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
}