"use client";

import { useActionState } from "react";
import { createUserAction } from "./actions";

export function UserForm() {
  const [error, formAction, pending] = useActionState(
    createUserAction,
    undefined
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          className="border rounded px-3 py-2 bg-transparent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="border rounded px-3 py-2 bg-transparent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Temporary password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="border rounded px-3 py-2 bg-transparent"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="role" className="text-sm font-medium">
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="member"
          className="border rounded px-3 py-2 bg-transparent"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-foreground text-background px-4 py-2 font-medium disabled:opacity-50"
      >
        {pending ? "Adding..." : "Add household member"}
      </button>
    </form>
  );
}
