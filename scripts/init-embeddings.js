const embeddingsManager = require('../src/nlp/embeddings.js');

async function initializeEmbeddings() {
    console.log('🚀 Inicializando embeddings...\n');

    try {
        await embeddingsManager.initialize();
        console.log('\n✅ Embeddings inicializados com sucesso!');
        console.log('💾 Cache salvo em: data/embeddings-cache.json\n');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Erro ao inicializar embeddings:', error.message);
        process.exit(1);
    }
}

initializeEmbeddings();