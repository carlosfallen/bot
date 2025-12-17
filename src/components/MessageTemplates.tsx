
import { createSignal, createEffect, For, Show } from "solid-js";

interface Template {
  id: number;
  nome: string;
  categoria: string;
  texto: string;
  variaveis?: string[];
}

export default function MessageTemplates() {
  const [templates, setTemplates] = createSignal<Template[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [selectedCategory, setSelectedCategory] = createSignal('todos');

  createEffect(() => {
    loadTemplates();
  });

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
      setLoading(false);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      setLoading(false);
    }
  };

  const categories = () => {
    const cats = new Set<string>();
    templates().forEach(t => cats.add(t.categoria));
    return ['todos', ...Array.from(cats)];
  };

  const filteredTemplates = () => {
    if (selectedCategory() === 'todos') return templates();
    return templates().filter(t => t.categoria === selectedCategory());
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Template copiado!');
  };

  return (
    <div class="bg-white rounded-lg shadow">
      <div class="p-4 border-b border-gray-200">
        <h2 class="text-xl font-bold text-gray-800">📝 Templates de Mensagens</h2>
      </div>

      <div class="p-4 border-b border-gray-200">
        <div class="flex gap-2 overflow-x-auto">
          <For each={categories()}>
            {(cat) => (
              <button
                onClick={() => setSelectedCategory(cat)}
                class={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
                  selectedCategory() === cat
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            )}
          </For>
        </div>
      </div>

      <div class="p-4">
        <Show when={loading()}>
          <div class="text-center py-8 text-gray-400">Carregando templates...</div>
        </Show>

        <Show when={!loading() && filteredTemplates().length === 0}>
          <div class="text-center py-8 text-gray-400">Nenhum template encontrado</div>
        </Show>

        <div class="space-y-3">
          <For each={filteredTemplates()}>
            {(template) => (
              <div class="border border-gray-200 rounded-lg p-4 hover:border-purple-500 transition">
                <div class="flex items-start justify-between mb-2">
                  <div>
                    <h3 class="font-medium text-gray-900">{template.nome}</h3>
                    <span class="text-xs text-gray-500">{template.categoria}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(template.texto)}
                    class="text-sm text-purple-600 hover:text-purple-700 px-3 py-1 rounded hover:bg-purple-50"
                  >
                    📋 Copiar
                  </button>
                </div>
                <div class="bg-gray-50 rounded p-3 text-sm text-gray-700 whitespace-pre-wrap">
                  {template.texto}
                </div>
                <Show when={template.variaveis && template.variaveis.length > 0}>
                  <div class="mt-2 text-xs text-gray-600">
                    <strong>Variáveis:</strong> {template.variaveis!.join(', ')}
                  </div>
                </Show>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}