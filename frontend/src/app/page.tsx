import { currentUser } from "@clerk/nextjs/server";
import { ChatLayout } from "@/components/chat";

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

  return <ChatLayout user={user} />;
}
