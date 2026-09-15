# Findings

Discrepancies between what is said about DPO Central elsewhere (the storefront) and
what this tree does today. Each entry states what the line says, what is true in the
code, and the smallest change on either side. Nothing here edits the storefront; that
is another repository.

1. **Storefront line, "The suite's shared login" (2026-09-15).**
   - *What the line says* (English and Spanish): the privacy programme in one place,
     then "The suite's shared login" / "El acceso común a toda la suite". Read as a
     product feature, it says users sign in to the suite through DPO Central.
   - *What is true today*: DPO Central runs its own NextAuth instance
     (`src/lib/auth.ts`). There is one login across the suite, but it is symmetrical,
     not central: on the hosted service every `.todo.law` app shares one session cookie
     (`AUTH_COOKIE_DOMAIN`) and one signing secret, and each app accepts a session
     minted by any sibling and provisions the user on first sight
     (`src/lib/jit-provisioning.ts`, `tests/jit-provisioning.test.ts`). On the
     self-hosted kit the three apps share `NEXTAUTH_SECRET` on localhost and use
     app-prefixed cookies so they do not overwrite each other. No sibling signs in
     "through" DPO Central; DPO Central is one peer among the apps named in the code
     (Dealroom and AI Sentinel). Whether any other product on the hosted domain accepts
     the same cookie cannot be confirmed from this tree.
   - *Smallest change*: on the storefront, "Shares the suite's single login" (ES:
     "Comparte el acceso único de la suite"). No code change.
