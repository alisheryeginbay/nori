"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Star, Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitHubRepo } from "@/app/api/github/repos/route";

interface RepoListProps {
  className?: string;
}

export function RepoList({ className }: RepoListProps) {
  const [repos, setRepos] = React.useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchRepos() {
      try {
        const response = await fetch("/api/github/repos");
        if (!response.ok) {
          if (response.status === 401 || response.status === 404) {
            setRepos([]);
            return;
          }
          throw new Error("Failed to fetch repos");
        }
        const data = await response.json();
        setRepos(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load repos");
      } finally {
        setIsLoading(false);
      }
    }

    fetchRepos();
  }, []);

  if (isLoading) {
    return (
      <div className={cn("grid grid-cols-4 gap-2", className)}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-[72px] rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error || repos.length === 0) {
    return null;
  }

  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {repos.slice(0, 8).map((repo, index) => (
        <motion.a
          key={repo.id}
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 500,
            damping: 30,
            delay: index * 0.03,
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "flex flex-col gap-1.5 p-3 rounded-xl",
            "bg-card border border-border",
            "hover:border-foreground/20 hover:bg-accent/50",
            "transition-colors duration-200",
            "cursor-pointer"
          )}
        >
          <div className="flex items-center gap-2">
            {repo.private ? (
              <Lock className="size-3.5 text-muted-foreground shrink-0" />
            ) : (
              <Globe className="size-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="text-sm font-medium truncate">{repo.name}</span>
          </div>
          {repo.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {repo.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-auto">
            {repo.language && (
              <div className="flex items-center gap-1">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: getLanguageColor(repo.language) }}
                />
                <span className="text-xs text-muted-foreground">
                  {repo.language}
                </span>
              </div>
            )}
            {repo.stargazers_count > 0 && (
              <div className="flex items-center gap-1">
                <Star className="size-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {repo.stargazers_count}
                </span>
              </div>
            )}
          </div>
        </motion.a>
      ))}
    </div>
  );
}

function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    TypeScript: "#3178c6",
    JavaScript: "#f1e05a",
    Python: "#3572A5",
    Rust: "#dea584",
    Go: "#00ADD8",
    Java: "#b07219",
    Ruby: "#701516",
    PHP: "#4F5D95",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    C: "#555555",
    "C++": "#f34b7d",
    "C#": "#239120",
    HTML: "#e34c26",
    CSS: "#563d7c",
    SCSS: "#c6538c",
    Vue: "#41b883",
    Svelte: "#ff3e00",
    Dart: "#00B4AB",
    Shell: "#89e051",
  };
  return colors[language] ?? "#8b949e";
}
