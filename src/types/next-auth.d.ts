import { DefaultSession } from "next-auth";
import { UserType } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      userType?: UserType | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userType?: UserType | null;
  }
}
