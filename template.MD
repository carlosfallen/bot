imperio-baileys-nlp/
├── bun.lockb
├── package.json
├── bunfig.toml
├── .env.example
├── .gitignore
├── drizzle.config.ts
├── wrangler.toml
├── schema.sql
├── src/
│   ├── index.tsx
│   ├── app.tsx
│   ├── routes/
│   │   ├── index.tsx
│   │   ├── config.tsx
│   │   ├── messages.tsx
│   │   └── conversations.tsx
│   ├── components/
│   │   ├── QRCodeDisplay.tsx
│   │   ├── ConversationList.tsx
│   │   ├── MessageTemplates.tsx
│   │   └── LiveChat.tsx
│   ├── server/
│   │   ├── api.ts
│   │   ├── whatsapp.ts
│   │   ├── nlp.ts
│   │   ├── db.ts
│   │   └── websocket.ts
│   └── lib/
│       ├── nlp-engine.ts
│       ├── message-builder.ts
│       └── templates.ts
└── public/
    └── assets/