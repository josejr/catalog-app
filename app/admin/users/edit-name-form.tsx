"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateUserNameAction } from "./actions";

export function EditNameForm({ userId, name }: { userId: string; name: string }) {
  const [editing, setEditing] = useState(false);
  const updateNameWithId = updateUserNameAction.bind(null, userId);
  const [error, formAction, pending] = useActionState(updateNameWithId, undefined);
  const wasPending = useRef(false);

  useEffect(() => {
    // Close the form once a submit finishes without an error; keep it open
    // (with the error shown) if the save failed.
    if (wasPending.current && !pending && !error) setEditing(false);
    wasPending.current = pending;
  }, [pending, error]);

  if (!editing) {
    return (
      <span className="flex items-center gap-2">
        <span className="font-medium">{name}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
        >
          Edit
        </button>
      </span>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        name="name"
        defaultValue={name}
        required
        autoFocus
        className="border rounded px-2 py-1 bg-transparent text-sm"
      />
      <button type="submit" disabled={pending} className="underline disabled:opacity-50">
        {pending ? "Saving..." : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="underline text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 transition-colors"
      >
        Cancel
      </button>
      {error && <span className="text-red-600">{error}</span>}
    </form>
  );
}
