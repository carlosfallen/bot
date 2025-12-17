
import { createSignal, createEffect, For, Show } from "solid-js";

interface Message {
  id: number;
  phone: string;
  direction: 'incoming' | 'outgoing';
  text: string;
  timestamp: number;
  nlp?: {
    intent: string;
    confidence: number;
    sentiment: string;
  };
}

interface LiveChatProps {
  phone: string;
  onClose?: () => void;
}

export default function LiveChat(props: LiveChatProps) {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [newMessage, setNewMessage] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [conversation, setConversation] = createSignal<any>(null);

  createEffect(() => {
    if (props.phone) {
      loadConversation();
    }
  });

  const loadConversation = async () => {
    try {
      const response = await fetch(`/api/conversation/${props.phone}`);
      const data = await response.json();
      setConversation(data.conversation);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Erro ao carregar conversa:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage().trim()) return;

    setLoading(true);
    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: props.phone,
          message: newMessage()
        })
      });

      if (response.ok) {
        setNewMessage('');
        await loadConversation();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div class="bg-white rounded-lg shadow flex flex-col h-[600px]">
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 class="font-bold text-gray-900">
            {conversation()?.nome || formatPhone(props.phone)}
          </h3>
          <Show when={conversation()?.empresa}>
            <div class="text-sm text-gray-600">🏢 {conversation()!.empresa}</div>
          </Show>
        </div>
        <div class="flex items-center gap-3">
          <Show when={conversation()}>
            <span class={`text-xs px-2 py-1 rounded-full font-medium ${
              conversation()!.qualification === 'quente'
                ? 'bg-red-100 text-red-800'
                : conversation()!.qualification === 'morno'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {conversation()!.qualification === 'quente' ? '🔥' : conversation()!.qualification === 'morno' ? '☀️' : '❄️'}
              {' '}{conversation()!.qualification}
            </span>
          </Show>
          <Show when={props.onClose}>
            <button onClick={props.onClose} class="text-gray-500 hover:text-gray-700">✕</button>
          </Show>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
        <Show when={messages().length === 0}>
          <div class="text-center text-gray-400 py-12">
            <div class="text-4xl mb-2">💬</div>
            <div>Nenhuma mensagem ainda</div>
          </div>
        </Show>

        <For each={messages()}>
          {(msg) => (
            <div class={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
              <div class="max-w-[70%]">
                <div class={`message-bubble ${msg.direction === 'outgoing' ? 'message-user' : 'message-bot'}`}>
                  <div class="text-sm whitespace-pre-wrap">{msg.text}</div>
                  <div class="text-xs text-gray-500 mt-1">
                    {formatTimestamp(msg.timestamp)}
                  </div>
                </div>

                <Show when={msg.nlp && msg.direction === 'incoming'}>
                  <div class="mt-1 text-xs space-x-1">
                    <span class="nlp-badge intent-badge">🎯 {msg.nlp!.intent}</span>
                    <span class={`nlp-badge confidence-${msg.nlp!.confidence >= 0.7 ? 'high' : msg.nlp!.confidence >= 0.4 ? 'medium' : 'low'}`}>
                      📊 {(msg.nlp!.confidence * 100).toFixed(0)}%
                    </span>
                    <span class={`nlp-badge sentiment-${msg.nlp!.sentiment}`}>
                      {msg.nlp!.sentiment === 'positive' ? '😊' : msg.nlp!.sentiment === 'negative' ? '😟' : '😐'}
                    </span>
                  </div>
                </Show>
              </div>
            </div>
          )}
        </For>
      </div>

      <div class="p-4 border-t border-gray-200">
        <div class="flex gap-2">
          <textarea
            value={newMessage()}
            onInput={(e) => setNewMessage(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            placeholder="Digite sua mensagem..."
            class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            rows={2}
            disabled={loading()}
          />
          <button
            onClick={sendMessage}
            disabled={loading() || !newMessage().trim()}
            class="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          >
            {loading() ? '⏳' : '📤'}
          </button>
        </div>
        <div class="text-xs text-gray-500 mt-2">
          Enter para enviar • Shift+Enter para nova linha
        </div>
      </div>
    </div>
  );
}