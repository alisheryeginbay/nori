import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  updated_at: string;
}

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await clerkClient();
    const tokens = await client.users.getUserOauthAccessToken(userId, "github");

    if (!tokens.data || tokens.data.length === 0) {
      return NextResponse.json(
        { error: "No GitHub token found" },
        { status: 404 }
      );
    }

    const githubToken = tokens.data[0].token;

    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50",
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch repos" },
        { status: response.status }
      );
    }

    const repos: GitHubRepo[] = await response.json();

    return NextResponse.json(repos);
  } catch (error) {
    console.error("Error fetching GitHub repos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
