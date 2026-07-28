import type { DefaultSession } from "next-auth";

// next-auth@5's own `.d.ts` re-exports Session/User/JWT from `@auth/core`
// via `export type { ... }`, a type-only re-export. TypeScript declaration
// merging only attaches to the module where an interface is *originally*
// declared, so augmenting "next-auth" / "next-auth/jwt" here is a no-op —
// the augmentation has to target `@auth/core` directly.
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: string;
  }
}
