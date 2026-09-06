# Multimodal AI Chatbot

A React and FastAPI chatbot with streamed answers, document questions, image inputs, web search, image generation, and saved conversations. Text responses try Gemini, then Groq and Mistral when a provider fails. Availability depends on provider access, quotas, connectivity, and database health.

## Features

- **Chat:** native WebSocket streaming, saved history, copy, edit, regenerate, and Stop. Editing replaces a question and removes subsequent messages; regenerating replaces the answer after the latest user question.
- **Documents:** text-based PDFs and UTF-8 TXT, Markdown, Python, or JavaScript files. Extracted text is stored in MongoDB; keyword matching selects relevant excerpts within the same conversation. No vector index or embedding service is required.
- **Images:** PNG, JPEG, WebP, and GIF inputs for Gemini, plus expandable image previews. Text-only fallback providers do not replace Gemini’s image understanding.
- **Search:** prefix a message with `/search ` to combine Google results through Serper with DuckDuckGo results.
- **Image generation:** keyword-based intent detection routes suitable requests to AI Horde. Queue polling can fail or time out; there is no Pollinations fallback.
- **Accounts:** email/password registration, EmailJS OTP verification and password reset, JWT authentication, and optional Google/GitHub sign-in.
- **Interface:** one composer outline, attachment previews/progress, processing and connection feedback, provider labels, editable starter prompts, Markdown tables, highlighted code, and math.
- **Sidebar:** padded, shortened titles. Rename and Delete appear on the hovered row or keyboard focus on pointer devices; touch devices keep the controls available. Removal is a soft delete from history, not permanent erasure of messages or documents.

Uploads are limited to **2 MB**, extracted text to **200,000 characters**, and chat messages to **20,000 characters**. Scanned PDFs need OCR before uploading; OCR is not implemented here. Large documents use selected excerpts, so answers may not cover every page.

## Stack and flow

| Layer | Implementation |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Backend | Python 3.11, FastAPI, Uvicorn |
| Streaming | Native WebSockets, not Socket.IO |
| Storage | MongoDB, Motor, Beanie |
| Text providers | Gemini → Groq → Mistral |
| Parsing | PyPDF2 and UTF-8 decoding |
| Search / images / email | Serper + DuckDuckGo / AI Horde / EmailJS |

The backend verifies ownership, saves the question, retrieves document excerpts, and performs search when explicitly requested. It then streams a provider response or generates an image. New titles come from the first message, not a separate title-generation model.

The checked-in IDs in `server/app/chat.py` are `gemini-3.5-flash-lite`, `llama-3.3-70b-versatile`, and `mistral-small-latest`. These describe the code, not guaranteed free-tier access or continued provider availability. Change them to IDs supported by your provider account when needed.

## Local setup

Use Python 3.11, Node.js 22, and a reachable MongoDB deployment. Keep secrets out of version control.

```sh
git clone https://github.com/sriram629/Multimodal-AI-ChatBot.git
cd Multimodal-AI-ChatBot/server
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

On Windows, activate with `venv\Scripts\activate`.

Create `server/.env`:

```dotenv
MONGO_URI=mongodb+srv://USER:PASSWORD@YOUR_CLUSTER.mongodb.net/?retryWrites=true&w=majority
SECRET_KEY=REPLACE_WITH_A_LONG_RANDOM_SECRET
FRONTEND_URL=http://localhost:5173
ALGORITHM=HS256

GOOGLE_API_KEY=YOUR_GEMINI_KEY
GROQ_API_KEY=YOUR_GROQ_KEY
MISTRAL_API_KEY=YOUR_MISTRAL_KEY
SERPER_API_KEY=YOUR_SERPER_KEY

EMAILJS_SERVICE_ID=YOUR_SERVICE_ID
EMAILJS_TEMPLATE_ID=YOUR_TEMPLATE_ID
EMAILJS_PUBLIC_KEY=YOUR_PUBLIC_KEY
EMAILJS_PRIVATE_KEY=YOUR_PRIVATE_KEY

GITHUB_CLIENT_ID=YOUR_GITHUB_OAUTH_CLIENT_ID
GITHUB_CLIENT_SECRET=YOUR_GITHUB_OAUTH_CLIENT_SECRET
```

`MONGO_URI` and a private `SECRET_KEY` are required at startup. Configure keys for the providers you use. EmailJS is required for OTP flows; its template receives `to_email` and `otp`. Serper is used for Google search. GitHub credentials enable GitHub sign-in.

Generate a secret with `openssl rand -hex 32`. The server reads `SECRET_KEY`, not `JWT_SECRET`. Token lifetime is currently seven days in `server/app/auth.py`, not an environment setting.

Accounts, sessions, and messages use `ai_chatbot_db`. Uploaded text uses the existing `ai_chat_db.vector_storage` collection. Give the database user access to both databases; the URI’s database path does not override these explicit names.

AI Horde currently uses the anonymous key in `server/app/tools.py`; an `AI_HORDE_KEY` environment variable does not change it. Document retrieval does not require a Hugging Face key. The application does not read SMTP settings.

Start the backend from `server`:

```sh
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, enter the repository’s `client` directory and run `npm ci`. Create `client/.env`:

```dotenv
VITE_API_URL=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=YOUR_GOOGLE_OAUTH_CLIENT_ID
VITE_GITHUB_CLIENT_ID=YOUR_GITHUB_OAUTH_CLIENT_ID
```

OAuth settings are needed for the corresponding sign-in buttons. Register the frontend’s `/login` URL with the provider, for example `http://localhost:5173/login`. The frontend and backend GitHub client IDs must match.

Run `npm run dev` and open [localhost:5173](http://localhost:5173). Backend documentation is at [localhost:8000/docs](http://127.0.0.1:8000/docs).

## Deployment

- The backend Dockerfile runs on port `10000`. For a non-Docker service, run from `server` with `uvicorn main:app --host 0.0.0.0 --port $PORT`.
- Set backend secrets in the hosting service. `FRONTEND_URL` accepts the exact frontend origin or comma-separated origins without extra spaces.
- Build from `client` with `npm ci && npm run build` and publish `dist`. Set `VITE_API_URL` to the HTTPS backend origin **before building**.
- Configure static hosting to serve `index.html` for client routes such as `/chat/...` and `/login`.
- Deploy both services for conversation controls and status/provider feedback. Configure MongoDB network access for the backend host.

`GET /health` checks database connectivity and returns HTTP 503 when unavailable. The database-health GitHub workflow attempts a daily request to the configured Render backend and supports manual runs. This does not guarantee continuous hosting or prevent every database pause; hosting policies and connectivity still apply.

## Validation

Run `npm run build` from `client`. The Node.js CI workflow checks the frontend build on pushes.

The temporary browser and backend test files used during development have been removed from the final tree. There is no retained Playwright test workflow.

Before deployment, check sending and stopping, PDF questions, image uploads, edit/regenerate, rename followed by reload, and removal of a disposable conversation. Check row hover and keyboard focus on desktop, and the sidebar/composer with the keyboard open on a phone. Also check failed uploads and offline/reconnect behavior. Live quotas and deployment configuration require real-service checks.

## Project layout

```text
client/src/
  components/       Chat input, messages, sidebar, shared UI
  contexts/         Authentication state
  hooks/            WebSocket and other hooks
  pages/            Landing, authentication, chat pages
  lib/              API client and utilities
server/
  main.py           Startup, middleware, health route
  app/auth.py       Accounts, OTP, JWT, OAuth
  app/chat.py       Sessions, streaming, provider calls
  app/database.py   Database initialization and health
  app/models.py     Beanie document models
  app/rag.py        Document storage and excerpt selection
  app/tools.py      Search and image generation
  app/utils.py      Upload parsing and validation
  app/email_service.py  EmailJS integration
.github/workflows/  Frontend build and database health checks
```

Report problems through [GitHub Issues](https://github.com/sriram629/Multimodal-AI-ChatBot/issues). Include the failing action and redacted logs; omit keys, passwords, and authentication tokens.
