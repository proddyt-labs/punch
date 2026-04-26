# Punch

Sistema interno de registro de ponto (entrada/saída) do trabalho, integrado ao stack do servidor via Docker + Nginx + Authentik (opcional).

## Stack
- **Frontend:** Vue 3 + TypeScript + Vite + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL (via Prisma ORM)
- **Auth:** Login próprio (JWT) + Authentik via proxy headers (opcional)
- **Deploy:** Docker Compose

## Funcionalidades
- Dashboard com registro de entrada/saída e horas trabalhadas
- Histórico com filtro por período de datas
- Autenticação JWT própria (Authentik como plus)

## Setup Local

```bash
# Backend
cd backend
cp .env.example .env
npm install
npx prisma db push
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Deploy no Servidor

```bash
cd ~ && git clone https://github.com/Proddy-0/punch.git
cd punch

docker compose up -d

# Banco (se não tiver banco dedicado)
docker exec authentik-postgresql psql -U authentik -d authentik -c "CREATE DATABASE \"punch\";"
```

## Nginx (servidor)

No nginx do servidor (`~/nginx/`), adicionar:

```nginx
location /punch {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Authentik (opcional)

Se o Nginx injetar headers `X-Authentik-Username`, `X-Authentik-Email`, `X-Authentik-Name`, o backend reconhece automaticamente. Sem isso, usa o login JWT próprio.
