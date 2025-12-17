import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import "./app.css";

export default function App() {
  return (
    <Router
      root={props => (
        <div class="min-h-screen bg-gray-50">
          <nav class="bg-purple-600 text-white shadow-lg">
            <div class="container mx-auto px-4 py-4">
              <div class="flex items-center justify-between">
                <h1 class="text-2xl font-bold">🚀 Império Lorde Bot</h1>
                <div class="flex gap-4">
                  <a href="/" class="hover:bg-purple-700 px-3 py-2 rounded">Dashboard</a>
                  <a href="/conversations" class="hover:bg-purple-700 px-3 py-2 rounded">Conversas</a>
                  <a href="/messages" class="hover:bg-purple-700 px-3 py-2 rounded">Mensagens</a>
                  <a href="/config" class="hover:bg-purple-700 px-3 py-2 rounded">Configuração</a>
                </div>
              </div>
            </div>
          </nav>
          <main class="container mx-auto px-4 py-8">
            <Suspense fallback={<div class="text-center py-8">Carregando...</div>}>
              {props.children}
            </Suspense>
          </main>
        </div>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
