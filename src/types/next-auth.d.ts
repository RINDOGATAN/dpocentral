import { DefaultSession } from "next-auth";
import { UserType } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    /** A sibling app's session for an address the e-mail policy refuses. */
    emailNotAccepted?: boolean;
    user: {
      id: string;
      userType?: UserType | null;
      /** True only when this product performed the sign-in itself. */
      signedInHere?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userType?: UserType | null;
    /** Stamped by this product's own sign-in; never trusted from a sibling. */
    dpoSignIn?: boolean;
    /** Set when a sibling's token carried an address the e-mail policy refuses. */
    emailNotAccepted?: boolean;
  }
}
