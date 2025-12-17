import { createSignal, createEffect, Show } from "solid-js";

interface QRCodeDisplayProps {
  connected: boolean;
}

export default function QRCodeDisplay(props: QRCodeDisplayProps) {
  const [qrCode, setQrCode] = createSignal<string>('');
  const [loading, setLoading] = createSignal(true);

  createEffect(() => {
    if (!props.connected) {
      loadQRCode();
      // Atualizar QR Code a cada 30 segundos se não conectado
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

  return (
    <div class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-bold text-gray-800 mb-4">📱 WhatsApp QR Code</h2>

      <Show when={props.connected}>
        <div class="text-center py-8">
          <div class="text-6xl mb-4">✅</div>
          <div class="text-green-600 font-bold text-lg">Conectado!</div>
          <div class="text-gray-600 text-sm mt-2">WhatsApp está pronto para uso</div>
        </div>
      </Show>

      <Show when={!props.connected}>
        <div class="space-y-4">
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
        </div>
      </Show>
    </div>
  );
}
