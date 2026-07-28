"use server";

import { hash } from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

export async function createUserAction(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await auth();
  if (session?.user.role !== "admin") {
    return "Only admins can add household members.";
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = formData.get("role") === "admin" ? "admin" : "member";

  if (!email || !name || password.length < 8) {
    return "Provide a name, email, and a password of at least 8 characters.";
  }

  const passwordHash = await hash(password, 12);

  try {
    await db.insert(users).values({ email, name, passwordHash, role });
  } catch {
    return "Could not create user - is the email already in use?";
  }

  revalidatePath("/admin/users");
}
