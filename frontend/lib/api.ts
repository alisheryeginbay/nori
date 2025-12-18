const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"

// --- Types ---

export interface UserData {
  id: string
  email: string | null
  name: string | null
  avatar_url: string | null
  has_anthropic_key: boolean
  created_at: string
  updated_at: string
}

export interface RepoStatus {
  id: string
  status: "pending" | "indexing" | "ready" | "error"
  chunks_count: number | null
  indexed_at: string | null
  error: string | null
  created_at: string
}

export interface Chat {
  id: string
  user_id: string
  repo_id: string
  title: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  chat_id: string
  role: "user" | "assistant"
  content: string
  created_at: string
}

export interface ChatWithMessages extends Chat {
  messages: ChatMessage[]
}

// --- User API ---

export async function getUser(userId: string): Promise<UserData> {
  const res = await fetch(`${BACKEND_URL}/users/${userId}`)
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("User not found")
    }
    throw new Error("Failed to fetch user")
  }
  return res.json()
}

export async function updateApiKey(userId: string, anthropicApiKey: string): Promise<{ has_anthropic_key: boolean }> {
  const res = await fetch(`${BACKEND_URL}/users/${userId}/api-keys`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anthropic_api_key: anthropicApiKey }),
  })
  if (!res.ok) {
    throw new Error("Failed to update API key")
  }
  return res.json()
}

export async function deleteApiKey(userId: string): Promise<{ has_anthropic_key: boolean }> {
  const res = await fetch(`${BACKEND_URL}/users/${userId}/api-keys`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anthropic_api_key: "" }),
  })
  if (!res.ok) {
    throw new Error("Failed to delete API key")
  }
  return res.json()
}

// --- Repo API ---

export async function getRepoStatus(owner: string, repo: string): Promise<RepoStatus | null> {
  const res = await fetch(`${BACKEND_URL}/repos/${owner}/${repo}`)
  if (res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error("Failed to fetch repo status")
  }
  return res.json()
}

export interface IndexProgress {
  stage: "cloning" | "parsing" | "embedding" | "storing"
  progress: number
  files_found?: number
  chunks?: number
}

export interface IndexResult {
  status: "ready" | "error"
  chunks_count?: number
  indexed_at?: string
  cached?: boolean
  message?: string
}

export async function indexRepo(
  owner: string,
  repo: string,
  userId: string,
  onProgress: (progress: IndexProgress) => void,
): Promise<IndexResult> {
  const res = await fetch(`${BACKEND_URL}/repos/${owner}/${repo}/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  })

  if (!res.ok || !res.body) {
    throw new Error("Failed to index repo")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let result: IndexResult | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    let currentEvent = ""
    let currentData = ""

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, "")

      if (trimmed === "") {
        // Process event
        if (currentEvent === "status" && currentData) {
          onProgress(JSON.parse(currentData))
        } else if (currentEvent === "done" && currentData) {
          result = JSON.parse(currentData)
        } else if (currentEvent === "error" && currentData) {
          throw new Error(JSON.parse(currentData).message)
        }
        currentEvent = ""
        currentData = ""
      } else if (trimmed.startsWith("event:")) {
        currentEvent = trimmed.slice(6).trim()
      } else if (trimmed.startsWith("data:")) {
        currentData = trimmed.slice(6)
      }
    }
  }

  if (!result) {
    throw new Error("No result received from indexing")
  }

  return result
}

// --- Chat API ---

export async function createChat(userId: string, repoId: string): Promise<Chat> {
  const res = await fetch(`${BACKEND_URL}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, repo_id: repoId }),
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.detail || "Failed to create chat")
  }
  return res.json()
}

export async function getChats(userId: string): Promise<Chat[]> {
  const res = await fetch(`${BACKEND_URL}/chats?user_id=${userId}`)
  if (!res.ok) {
    throw new Error("Failed to fetch chats")
  }
  return res.json()
}

export async function getChat(chatId: string): Promise<ChatWithMessages> {
  const res = await fetch(`${BACKEND_URL}/chats/${chatId}`)
  if (!res.ok) {
    throw new Error("Failed to fetch chat")
  }
  return res.json()
}

export async function deleteChat(chatId: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/chats/${chatId}`, { method: "DELETE" })
  if (!res.ok) {
    throw new Error("Failed to delete chat")
  }
}

export interface StreamCallbacks {
  onSources?: (sources: Array<{ file: string; name: string; type: string }>) => void
  onText: (text: string) => void
  onError?: (error: string) => void
  onDone?: () => void
}

export async function sendMessage(
  chatId: string,
  content: string,
  userId: string,
  callbacks: StreamCallbacks,
): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, user_id: userId }),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.detail || "Failed to send message")
  }

  if (!res.body) {
    throw new Error("No response body")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""

    let currentEvent = ""
    let currentData: string[] = []

    for (const line of lines) {
      const trimmed = line.replace(/\r$/, "")

      if (trimmed === "") {
        // Process event
        if (currentEvent === "text" && currentData.length > 0) {
          callbacks.onText(currentData.join("\n"))
        } else if (currentEvent === "sources" && currentData.length > 0) {
          callbacks.onSources?.(JSON.parse(currentData.join("\n")))
        } else if (currentEvent === "error" && currentData.length > 0) {
          callbacks.onError?.(currentData.join("\n"))
        } else if (currentEvent === "done") {
          callbacks.onDone?.()
        }
        currentEvent = ""
        currentData = []
      } else if (trimmed.startsWith("event:")) {
        currentEvent = trimmed.slice(6).trim()
      } else if (trimmed.startsWith("data:")) {
        currentData.push(trimmed.slice(6))
      }
    }
  }
}
