export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-muted/50">
      <div className="flex-1 flex items-center justify-center">
        {children}
      </div>
      <footer className="py-4 text-center text-xs text-muted-foreground space-y-1">
        <p>DPO Central, a North End Law service</p>
        <div className="flex justify-center gap-4">
          <a href="https://northend.law/terms-of-use" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline">
            Terms of Use
          </a>
          <a href="https://northend.law/privacy-policy" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline">
            Privacy Policy
          </a>
        </div>
      </footer>
    </div>
  );
}
