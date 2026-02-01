import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-card/30 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground font-mono">
          <div>
            &copy; 2026 Innov Studio.
          </div>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link>
            <Link href="/documentation" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-footer-documentation">Documentation</Link>
            <Link href="/" className="hover:text-primary cursor-pointer transition-colors" data-testid="link-footer-support">Support</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
