# RAG (Retrieval Augmented Generation) System

Beacon Flow uses a RAG pipeline to personalize AI-generated LinkedIn content based on the user's past posts, writing style, and preferences.

## How It Works

### Architecture Overview

```
User Creates/Updates Post
        |
        v
  syncPostMemoryForPost()
        |
        +--> Generate embedding (OpenAI text-embedding-3-small, 1536 dims)
        +--> Extract intent, themes, style signals
        +--> Upsert into m_post_memories (pgvector)
        +--> Recompute style profile
        |
        v
  Post is now searchable via vector similarity


User Requests New Content (hooks / post / suggestions)
        |
        v
  getGenerationContextForDevice()
        |
        +--> Embed the query text (topic, hook, etc.)
        +--> Vector similarity search (cosine distance) in PostgreSQL
        +--> Retrieve top K similar past posts (default: 4)
        +--> Load style profile + user preferences
        |
        v
  buildMemoryPrompt()
        |
        +--> Format retrieved memories, style, preferences into prompt
        |
        v
  LLM generates content with full context of user's history
```

## When RAG Triggers

### Writing (Indexing) — Posts added to memory

| Action | Endpoint | What happens |
|--------|----------|-------------|
| Save draft | `POST /api/posts` | Embed post, store in `m_post_memories`, recompute style profile |
| Edit post | `PATCH /api/posts/:id` | Re-embed updated content, update memory, recompute style |
| Change status | `PATCH /api/posts/:id/status` | Re-sync memory with new status, recompute style |
| Publish to LinkedIn | `POST /api/linkedin/publish` | Sync memory, recompute style |
| Manual rebuild | `POST /api/cognition/rebuild` | Re-embed ALL posts, rebuild style profile from scratch |

### Reading (Retrieval) — Past posts used as context

| Action | Endpoint | Query used for similarity search |
|--------|----------|--------------------------------|
| Generate hooks | `POST /api/linkedin/generate-hooks` | The topic text |
| Generate post | `POST /api/linkedin/generate-post` | Topic + hook combined |
| Need Inspiration | `POST /api/linkedin/get-suggestion` | Last 10 topics joined together |

### Not using RAG (yet)

| Action | Endpoint | Reason |
|--------|----------|--------|
| Regenerate section | `POST /api/linkedin/regenerate-section` | Uses only current post context |
| Recommend intention | `POST /api/linkedin/recommend-intention` | Uses only hook + topic |

## Database Tables

### `m_post_memories`
Stores embeddings and metadata for each post.

| Column | Type | Purpose |
|--------|------|---------|
| `device_id` | text | User identifier |
| `post_id` | integer | Reference to `m_users_posts` |
| `embedding` | vector(1536) | pgvector column for similarity search |
| `embedding_json` | jsonb | JSON fallback if pgvector unavailable |
| `embedding_state` | text | `pending`, `ready`, or `failed` |
| `text` | text | Concatenated topic + hook + framework + post |
| `summary` | text | Short summary for prompt injection |
| `inferred_intent` | text | Detected content framework (e.g., `story-insight`, `problem-solution`) |
| `themes` | jsonb | Top extracted keywords/themes |
| `style_signals` | jsonb | Avg sentence length, emoji count, format type, etc. |

### `m_style_profiles`
Aggregated writing style per user, rebuilt after every post change.

| Column | Type | Purpose |
|--------|------|---------|
| `device_id` | text | User identifier |
| `summary` | text | Human-readable style description |
| `tone` | jsonb | e.g., `["conversational", "skimmable", "emoji-friendly"]` |
| `common_themes` | jsonb | Top recurring topics across all posts |
| `format_habits` | jsonb | Distribution of list vs story vs paragraph |
| `cta_habits` | jsonb | Question vs statement CTA rate |
| `confidence` | numeric | 0-1 score based on post count |

### `m_user_preferences`
Explicit preferences set by the user.

| Column | Type | Purpose |
|--------|------|---------|
| `preferred_tone` | text | e.g., "professional", "casual" |
| `target_audience` | text | Who the user writes for |
| `preferred_formats` | jsonb | Preferred post structures |
| `forbidden_phrases` | jsonb | Words/phrases to avoid |

## Key Files

```
src/
├── services/
│   ├── cognitiveMemoryService.ts   # Core RAG logic (embed, search, sync, style)
│   ├── memoryPromptService.ts      # Builds context-aware prompts from memories
│   ├── preferenceService.ts        # User preference management
│   └── openaiService.ts            # OpenAI embedding + chat calls
├── repositories/
│   └── cognitiveRepository.ts      # pgvector queries, memory CRUD
├── controllers/
│   ├── linkedinController.ts       # Generation endpoints (RAG consumer)
│   ├── postsController.ts          # Post CRUD (RAG indexer)
│   └── cognitionController.ts      # RAG admin endpoints
├── routes/
│   └── cognitionRoutes.ts          # /api/cognition/* routes
└── types/
    └── cognition.ts                # TypeScript types for memory system
```

## Similarity Search

- **Primary**: PostgreSQL `pgvector` extension with IVFFlat index using cosine distance (`<=>` operator)
- **Fallback**: Client-side cosine similarity over `embedding_json` if pgvector is unavailable
- **Similarity bands**: high (>= 0.88), medium (>= 0.76), low (< 0.76)
- **Top K**: Configurable via `COGNITION_TOP_K` env var (default: 4)

## Memory Prompt Structure

When generating content, the memory prompt includes three sections:

1. **User Preferences** — explicit tone, audience, format, and constraints
2. **Style Profile** — inferred writing patterns (tone, themes, structure, CTA habits)
3. **Similar Past Posts** — top K retrieved memories with topic, summary, and similarity band

This prompt is appended to the generation system prompt so the LLM produces content that matches the user's established voice.

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | — | Required for embeddings and generation |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model |
| `COGNITION_TOP_K` | `4` | Number of similar posts to retrieve |
| `INSPIRATION_MIN_POSTS` | `5` | Minimum posts before "Need Inspiration" is available |
| `INSPIRATION_SUGGESTION_COUNT` | `5` | Number of topic suggestions to generate |

## API Endpoints

### Cognition (RAG Admin)

```
POST /api/cognition/rebuild     — Rebuild all embeddings + style profile
GET  /api/cognition/profile     — Get style profile + preferences
GET  /api/cognition/status      — Check RAG system health (pgvector status, memory counts, confidence)
```

All endpoints require `X-Device-ID` header.
