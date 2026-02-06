import { Github } from "lucide-react";
import { brand } from "@/config/brand";

export function LandingFooter() {
  return (
    <footer className="py-12 border-t border-[#333333]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <a href="/" className="flex items-center">
            <img src={brand.logoPath} alt={brand.name} className="h-8 w-auto" />
          </a>

          <div className="flex items-center gap-6">
            <a
              href={brand.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#a0a0a0] hover:text-[#fefeff] transition-colors font-body"
            >
              Privacy Policy
            </a>
            <a
              href={brand.termsOfUseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#a0a0a0] hover:text-[#fefeff] transition-colors font-body"
            >
              Terms of Service
            </a>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-[#a0a0a0] font-body">
              <a
                href="https://creativecommons.org/licenses/by-nd/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#fefeff] transition-colors"
              >
                CC BY-ND
              </a>
              {" "}Sergio Maldonado &{" "}
              <a
                href="https://rindogatan.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#fefeff] transition-colors"
              >
                Rindogatan
              </a>
            </div>
            <a
              href="https://github.com/rindogatan"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#a0a0a0] hover:text-[#53aecc] transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
