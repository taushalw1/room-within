import Link from "next/link";
import { Mail, Facebook, MapPin } from "lucide-react";
import { LogoTile } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Section";
import { site, nav } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="bg-olive text-cream">
      <Container className="py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            {/* On a cream panel: the wordmark is deep olive, which would be
                invisible directly on the olive footer. */}
            <LogoTile />
            <p className="script mt-5 text-2xl text-blush">
              Join us in preserving history and building a stronger future for
              Grassy Lake.
            </p>
          </div>

          <nav aria-label="Footer">
            <h2 className="eyebrow text-cream/70">Explore</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {nav.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-cream/85 transition-colors hover:text-cream"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow text-cream/70">Get in touch</h2>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="flex items-start gap-2.5 text-cream/85 transition-colors hover:text-cream"
                >
                  <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span className="break-all">{site.email}</span>
                </a>
              </li>
              <li>
                <a
                  href={site.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 text-cream/85 transition-colors hover:text-cream"
                >
                  <Facebook className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{site.facebookLabel}</span>
                </a>
              </li>
              <li>
                <a
                  href={site.address.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2.5 text-cream/85 transition-colors hover:text-cream"
                >
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {site.address.street}
                    <span className="block">
                      {site.address.locality}, {site.address.region}{" "}
                      {site.address.postalCode}
                    </span>
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="eyebrow text-cream/70">For tenants & members</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  href="/portal"
                  className="text-cream/85 transition-colors hover:text-cream"
                >
                  Tenant portal
                </Link>
              </li>
              <li>
                <Link
                  href="/my-bookings"
                  className="text-cream/85 transition-colors hover:text-cream"
                >
                  My bookings
                </Link>
              </li>
              <li>
                <Link
                  href="/calendar/subscribe"
                  className="text-cream/85 transition-colors hover:text-cream"
                >
                  Add calendar to Google
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-cream/20 pt-6 text-xs text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name} · {site.town}
          </p>
          <p className="flex gap-4">
            <Link href="/privacy" className="hover:text-cream">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-cream">
              Terms
            </Link>
          </p>
        </div>
      </Container>
    </footer>
  );
}
