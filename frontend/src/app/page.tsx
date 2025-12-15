import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { ChatLayout } from "@/components/chat";
import type { GitHubRepo } from "@/app/api/github/repos/route";

async function getGitHubRepos(userId: string): Promise<GitHubRepo[]> {
  try {
    const client = await clerkClient();
    const tokens = await client.users.getUserOauthAccessToken(userId, "github");

    if (!tokens.data || tokens.data.length === 0) {
      return [];
    }

    const githubToken = tokens.data[0].token;

    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=50",
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
        },
        next: { revalidate: 60 },
      }
    );

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch {
    return [];
  }
}

export default async function Home() {
  const clerkUser = await currentUser();

  const user = clerkUser
    ? {
        id: clerkUser.id,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        fullName: clerkUser.fullName,
        imageUrl: clerkUser.imageUrl,
        email: clerkUser.emailAddresses[0]?.emailAddress ?? null,
      }
    : null;

  const repos = user ? await getGitHubRepos(user.id) : [];

  return <ChatLayout user={user} repos={repos} />;
}
