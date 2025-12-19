"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Highlight, themes } from "prism-react-renderer"
import { cn } from "@/lib/utils"

export interface Source {
  file: string
  name: string
  type: string
  repo: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: Source[]
}

interface ChatMessageProps {
  message: Message
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  return (
    <Highlight theme={themes.vsDark} code={code} language={language}>
      {({ style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className="rounded-lg p-4 overflow-x-auto text-sm"
          style={{ ...style, margin: 0 }}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  )
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user"

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm bg-primary text-primary-foreground">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full text-sm">
      <div className="markdown-content space-y-3 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-1 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-3 [&_h3]:font-semibold [&_h3]:mt-2 [&_blockquote]:border-l-2 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-blue-500 [&_a]:underline [&_hr]:my-4 [&_hr]:border-zinc-300 dark:[&_hr]:border-zinc-700 dark:[&_blockquote]:border-zinc-600">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || "")
              const code = String(children).replace(/\n$/, "")
              const isMultiLine = code.includes("\n")

              if (match) {
                return <CodeBlock language={match[1]} code={code} />
              }

              // Multi-line code without language - render as plain block
              if (isMultiLine) {
                return (
                  <pre className="bg-zinc-800 text-zinc-100 rounded-lg p-4 overflow-x-auto text-sm font-mono whitespace-pre">
                    {code}
                  </pre>
                )
              }

              // Inline code
              return (
                <code
                  className="bg-zinc-700 text-zinc-100 px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              )
            },
            pre({ children }) {
              return <>{children}</>
            },
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
