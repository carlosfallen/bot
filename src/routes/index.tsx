import { createSignal, createEffect, For, Show } from "solid-js";
import QRCodeDisplay from "../components/QRCodeDisplay";

interface Message {
  id: number;
  type: 'user' | 'bot';
  text: string;
  timestamp: Date;
  nlp?: {
    intent: string;
    confidence: number;
    sentiment: string;
    entities?: Record<string, any>;
  };
}

interface Stats {
  totalLeads: number;
  activeConversations: number;
  todayMessages: number;
  hotLeads: number;
}

export default function Dashboard() {
  const [phone, setPhone] = createSignal('5585999999999');
  const [message, setMessage] = createSignal('');
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [stats, setStats] = createSignal<Stats>({
    totalLeads: 0,
    activeConversations: 0,
    todayMessages: 0,
    hotLeads: 0
  });
  const [wsConnected, setWsConnected] = createSignal(false);
  const [whatsappConnected, setWhatsappConnected] = createSignal(false);

  // WebSocket connection
  let ws: WebSocket | null = null;

  createEffect(() => {
    connectWebSocket();
    loadStats();

    return () => {
      if (ws) ws.close();
    };
  });

  const connectWebSocket = () => {
    const wsUrl = `ws://${window.location.hostname}:3001`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket conectado');
      setWsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket desconectado');
      setWsConnected(false);
      // Tentar reconectar após 3 segundos
      setTimeout(connectWebSocket, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'qr') {
          setWhatsappConnected(false);
        } else if (data.type === 'ready') {
          setWhatsappConnected(true);
        } else if (data.type === 'message') {
          // Adicionar mensagem recebida
          const newMessage: Message = {
            id: Date.now(),
            type: 'bot',
            text: data.message,
            timestamp: new Date(),
            nlp: data.nlp
          };
          setMessages(prev => [...prev, newMessage]);
        }
      } catch (error) {
        console.error('Erro ao processar mensagem WebSocket:', error);
      }
    };
  };

  const loadStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const sendTestMessage = async () => {
    if (!message().trim()) return;

    setLoading(true);

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: Date.now(),
      type: 'user',
      text: message(),
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    try {
      const response = await fetch('/api/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone(),
          message: message()
        })
      });

      const data = await response.json();

      // Adicionar resposta do bot
      const botMessage: Message = {
        id: Date.now() + 1,
        type: 'bot',
        text: data.response,
        timestamp: new Date(),
        nlp: data.nlp
      };
      setMessages(prev => [...prev, botMessage]);

      setMessage('');
      loadStats();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      alert('Erro ao enviar mensagem. Verifique se o servidor está rodando.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendTestMessage();
    }
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.7) return 'confidence-high';
    if (confidence >= 0.4) return 'confidence-medium';
    return 'confidence-low';
  };

  const clearMessages = () => {
    setMessages([]);
  };

  return (
    <div class="space-y-6">
      {/* Header com Status */}
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold text-gray-800">Dashboard de Testes</h1>
            <p class="text-gray-600 mt-1">Envie mensagens de teste e veja as respostas do bot com análise NLP</p>
          </div>
          <div class="flex gap-4">
            <div class="text-center">
              <div class={`w-3 h-3 rounded-full mx-auto mb-1 ${wsConnected() ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div class="text-xs text-gray-600">WebSocket</div>
            </div>
            <div class="text-center">
              <div class={`w-3 h-3 rounded-full mx-auto mb-1 ${whatsappConnected() ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <div class="text-xs text-gray-600">WhatsApp</div>
            </div>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm font-medium text-gray-600">Total de Leads</div>
          <div class="text-3xl font-bold text-purple-600 mt-2">{stats().totalLeads}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm font-medium text-gray-600">Conversas Ativas</div>
          <div class="text-3xl font-bold text-blue-600 mt-2">{stats().activeConversations}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm font-medium text-gray-600">Mensagens Hoje</div>
          <div class="text-3xl font-bold text-green-600 mt-2">{stats().todayMessages}</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-sm font-medium text-gray-600">Leads Quentes 🔥</div>
          <div class="text-3xl font-bold text-orange-600 mt-2">{stats().hotLeads}</div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code */}
        <div class="lg:col-span-1">
          <QRCodeDisplay connected={whatsappConnected()} />
        </div>

        {/* Interface de Teste */}
        <div class="lg:col-span-2 bg-white rounded-lg shadow">
          <div class="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-800">💬 Teste de Conversação</h2>
            <button
              onClick={clearMessages}
              class="text-sm text-gray-600 hover:text-gray-800 px-3 py-1 rounded hover:bg-gray-100"
            >
              Limpar
            </button>
          </div>

          {/* Área de Mensagens */}
          <div class="h-96 overflow-y-auto p-4 bg-gray-50 scrollbar-hide">
            <Show when={messages().length === 0}>
              <div class="text-center text-gray-400 py-12">
                <div class="text-4xl mb-2">💬</div>
                <div>Nenhuma mensagem ainda</div>
                <div class="text-sm mt-1">Envie uma mensagem de teste abaixo</div>
              </div>
            </Show>

            <For each={messages()}>
              {(msg) => (
                <div class={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} mb-4`}>
                  <div class="max-w-[70%]">
                    <div class={`message-bubble ${msg.type === 'user' ? 'message-user' : 'message-bot'}`}>
                      <div class="text-sm">{msg.text}</div>
                      <div class="text-xs text-gray-500 mt-1">
                        {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>

                    {/* Análise NLP */}
                    <Show when={msg.nlp}>
                      <div class="mt-2 text-xs space-y-1">
                        <div>
                          <span class="nlp-badge intent-badge">
                            🎯 {msg.nlp!.intent}
                          </span>
                          <span class={`nlp-badge ${getConfidenceClass(msg.nlp!.confidence)}`}>
                            📊 {(msg.nlp!.confidence * 100).toFixed(0)}%
                          </span>
                          <span class={`nlp-badge sentiment-${msg.nlp!.sentiment}`}>
                            {msg.nlp!.sentiment === 'positive' ? '😊' : msg.nlp!.sentiment === 'negative' ? '😟' : '😐'}
                          </span>
                        </div>
                        <Show when={msg.nlp!.entities && Object.keys(msg.nlp!.entities).length > 0}>
                          <div class="text-gray-600 bg-gray-100 rounded px-2 py-1">
                            <strong>Entidades:</strong>{' '}
                            {Object.entries(msg.nlp!.entities!)
                              .map(([key, value]) => `${key}: ${value}`)
                              .join(', ')}
                          </div>
                        </Show>
                      </div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>

          {/* Input de Mensagem */}
          <div class="p-4 border-t border-gray-200">
            <div class="mb-3">
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Número de Teste (simulado)
              </label>
              <input
                type="text"
                value={phone()}
                onInput={(e) => setPhone(e.currentTarget.value)}
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="5585999999999"
              />
            </div>

            <div class="flex gap-2">
              <textarea
                value={message()}
                onInput={(e) => setMessage(e.currentTarget.value)}
                onKeyPress={handleKeyPress}
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Digite sua mensagem de teste..."
                rows={2}
                disabled={loading()}
              />
              <button
                onClick={sendTestMessage}
                disabled={loading() || !message().trim()}
                class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
              >
                {loading() ? '⏳' : '📤'}
              </button>
            </div>
            <div class="text-xs text-gray-500 mt-2">
              Pressione Enter para enviar • Shift+Enter para nova linha
            </div>
          </div>
        </div>
      </div>

      {/* Exemplos de Mensagens */}
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-bold text-gray-800 mb-3">💡 Exemplos de Mensagens para Testar</h3>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={() => setMessage('Olá! Quero saber sobre tráfego pago')}
            class="text-left p-3 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
          >
            <div class="font-medium text-sm">Interesse em Tráfego</div>
            <div class="text-xs text-gray-600 mt-1">Olá! Quero saber sobre tráfego pago</div>
          </button>
          <button
            onClick={() => setMessage('Preciso de criativos para Instagram, urgente!')}
            class="text-left p-3 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
          >
            <div class="font-medium text-sm">Criativos Urgente</div>
            <div class="text-xs text-gray-600 mt-1">Preciso de criativos para Instagram, urgente!</div>
          </button>
          <button
            onClick={() => setMessage('Meu nome é João da empresa XYZ, orçamento de R$ 5000')}
            class="text-left p-3 border border-gray-200 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition"
          >
            <div class="font-medium text-sm">Qualificação Lead</div>
            <div class="text-xs text-gray-600 mt-1">Nome, empresa e orçamento</div>
          </button>
        </div>
      </div>
    </div>
  );
}
