import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { EditNameForm } from "./edit-name-form";
import { UserForm } from "./user-form";

export default async function AdminUsersPage() {
  const session = await auth();
  if (session?.user.role !== "admin") {
    redirect("/");
  }

  const householdMembers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(users.createdAt);

  return (
    <div className="flex-1 p-6 flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold mb-4">Household members</h1>
        <ul className="flex flex-col gap-2">
          {householdMembers.map((member) => (
            <li key={member.id} className="flex items-center gap-3 text-sm">
              <EditNameForm userId={member.id} name={member.name} />
              <span className="text-neutral-500">{member.email}</span>
              <span className="text-neutral-500">{member.role}</span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-4">Add a household member</h2>
        <UserForm />
      </div>
    </div>
  );
}
