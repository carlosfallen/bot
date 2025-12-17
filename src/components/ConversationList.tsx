
import { For, Show, createSignal } from "solid-js";

interface Conversation {
  phone: string;
  nome?: string;
  empresa?: string;
  status: string;
  qualification: string;
  lastMessage: string;
  lastInteraction: number;
  messageCount: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  onSelect?: (phone: string) => void;
}

export default function ConversationList(props: ConversationListProps) {
  const [selectedPhone, setSelectedPhone] = createSignal<string>('');

  const handleSelect = (phone: string) => {
    setSelectedPhone(phone);
    if (props.onSelect) {
      props.onSelect(phone);
    }
  };

  const getQualificationColor = (qual: string) => {
    switch (qual) {
      case 'quente': return 'bg-red-100 text-red-800';
      case 'morno': return 'bg-yellow-100 text-yellow-800';
      case 'frio': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getQualificationEmoji = (qual: string) => {
    switch (qual) {
      case 'quente': return '🔥';
      case 'morno': return '☀️';
      case 'frio': return '❄️';
      default: return '📊';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-green-500';
      case 'aguardando': return 'bg-yellow-500';
      case 'handoff': return 'bg-purple-500';
      case 'finalizado': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    return `${days}d`;
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\\D/g, '');
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 4)} ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  return (
    <div class="bg-white rounded-lg shadow">
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-xl font-bold text-gray-800">💬 Conversas ({props.conversations.length})</h2>
      </div>

      <div class="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
        <Show when={props.conversations.length === 0}>
          <div class="p-8 text-center text-gray-400">
            <div class="text-4xl mb-2">📭</div>
            <div>Nenhuma conversa ativa</div>
          </div>
        </Show>

        <For each={props.conversations}>
          {(conv) => (
            <div
              onClick={() => handleSelect(conv.phone)}
              class={`p-4 cursor-pointer hover:bg-gray-50 transition ${
                selectedPhone() === conv.phone ? 'bg-purple-50 border-l-4 border-purple-600' : ''
              }`}
            >
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-1">
                    <div class={`w-2 h-2 rounded-full ${getStatusColor(conv.status)}`}></div>
                    <h3 class="font-medium text-gray-900 truncate">
                      {conv.nome || formatPhone(conv.phone)}
                    </h3>
                  </div>
                  <Show when={conv.empresa}>
                    <div class="text-xs text-gray-600 mb-1">🏢 {conv.empresa}</div>
                  </Show>
                </div>
                <div class="flex flex-col items-end gap-1 ml-2">
                  <span class="text-xs text-gray-500">
                    {formatTime(conv.lastInteraction)}
                  </span>
                  <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${getQualificationColor(conv.qualification)}`}>
                    {getQualificationEmoji(conv.qualification)} {conv.qualification}
                  </span>
                </div>
              </div>

              <p class="text-sm text-gray-600 truncate mb-2">
                {conv.lastMessage}
              </p>

              <div class="flex items-center gap-3 text-xs text-gray-500">
                <span>📱 {formatPhone(conv.phone)}</span>
                <span>💬 {conv.messageCount} msg</span>
                <span class="capitalize">📊 {conv.status}</span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}