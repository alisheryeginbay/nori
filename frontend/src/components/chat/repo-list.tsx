import { Star, Lock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GitHubRepo } from "@/app/api/github/repos/route";

interface RepoListProps {
  repos: GitHubRepo[];
  selectedRepo?: string;
  onSelect?: (repo: GitHubRepo) => void;
  className?: string;
}

export function RepoList({ repos, selectedRepo, onSelect, className }: RepoListProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-2", className)}>
      {repos.slice(0, 8).map((repo) => {
        const isSelected = selectedRepo === repo.full_name;
        return (
          <button
            key={repo.id}
            type="button"
            onClick={() => onSelect?.(repo)}
            className={cn(
              "flex flex-col gap-1.5 p-3 rounded-xl text-left",
              "bg-card border border-border",
              "hover:border-foreground/20 hover:bg-accent/50",
              "transition-colors duration-200",
              isSelected && "ring-2 ring-primary border-primary"
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
          </button>
        );
      })}
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
