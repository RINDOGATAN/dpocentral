"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  ExternalLink,
  Award,
  Loader2,
  CheckCircle2,
  Globe,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { features } from "@/config/features";
import { useRouter } from "next/navigation";

const PAGE_SIZE = 20;

export default function ExpertsPage() {
  const router = useRouter();

  useEffect(() => {
    if (!features.expertDirectoryEnabled) {
      router.replace("/privacy");
    }
  }, [router]);

  if (!features.expertDirectoryEnabled) return null;

  const [searchQuery, setSearchQuery] = useState("");
  const [specialization, setSpecialization] = useState<string>("");
  const [country, setCountry] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [expertType, setExpertType] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const debouncedSearch = useDebounce(searchQuery);

  // Reset pagination when filters change
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, specialization, country, language, expertType]);

  const { data: filters } = trpc.experts.listFilters.useQuery();

  const { data: searchResult, isLoading } = trpc.experts.search.useQuery({
    query: debouncedSearch || undefined,
    specialization: specialization && specialization !== "all" ? specialization : undefined,
    country: country && country !== "all" ? country : undefined,
    language: language && language !== "all" ? language : undefined,
    expertType:
      expertType && expertType !== "all"
        ? (expertType as "legal" | "technical" | "both")
        : undefined,
    limit: PAGE_SIZE,
    offset,
  });

  const experts = searchResult?.results ?? [];
  const total = searchResult?.total ?? 0;
  const hasMore = offset + PAGE_SIZE < total;

  const hasFilters =
    debouncedSearch ||
    (specialization && specialization !== "all") ||
    (country && country !== "all") ||
    (language && language !== "all") ||
    (expertType && expertType !== "all");

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">Find a Privacy Expert</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connect with certified privacy professionals who can help with your compliance needs
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, firm, or expertise..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Select value={specialization} onValueChange={setSpecialization}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Specialization" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specializations</SelectItem>
              {filters?.specializations.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={expertType} onValueChange={setExpertType}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Expert Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {filters?.expertTypes.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {filters?.countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder="Language" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Languages</SelectItem>
              {filters?.languages.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Result count */}
      {!isLoading && total > 0 && (
        <p className="text-xs text-muted-foreground">
          Showing {Math.min(offset + PAGE_SIZE, total)} of {total} expert{total !== 1 ? "s" : ""}
        </p>
      )}

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : experts.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experts.map((expert) => (
              <Card key={expert.id} className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4 sm:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm sm:text-base truncate">
                        {expert.name ?? "Unnamed Expert"}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {expert.title ?? "Privacy Expert"}
                      </p>
                      {expert.firm && (
                        <p className="text-xs text-primary truncate">{expert.firm}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        {expert.expertType === "both"
                          ? "Legal & Tech"
                          : expert.expertType === "legal"
                            ? "Legal"
                            : "Technical"}
                      </Badge>
                      {expert.acceptingClients && (
                        <span className="flex items-center gap-1 text-[10px] text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          Available
                        </span>
                      )}
                    </div>
                  </div>

                  {expert.bio && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{expert.bio}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {expert.specializations.map((s) => (
                      <Badge key={s} variant="secondary" className="text-xs">
                        {s}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <div className="flex flex-col gap-0.5">
                      {(expert.location.city || expert.location.country) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {[expert.location.city, expert.location.country]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      )}
                      {expert.jurisdictions.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {expert.jurisdictions.join(", ")}
                        </span>
                      )}
                    </div>
                    {expert.certifications.length > 0 && (
                      <span className="flex items-center gap-1 shrink-0">
                        <Award className="w-3 h-3" />
                        {expert.certifications.join(", ")}
                      </span>
                    )}
                  </div>

                  {expert.contactUrl ? (
                    <a
                      href={expert.contactUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button variant="outline" size="sm" className="w-full gap-2">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Contact Expert
                      </Button>
                    </a>
                  ) : (
                    <Button variant="outline" size="sm" className="w-full gap-2" disabled>
                      <ExternalLink className="w-3.5 h-3.5" />
                      No Contact Available
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {(hasMore || offset > 0) && (
            <div className="flex items-center justify-center gap-3 pt-2">
              {offset > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                >
                  Previous
                </Button>
              )}
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  Next
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            {hasFilters
              ? "No experts found matching your criteria. Try adjusting your filters."
              : "No experts available at this time."}
          </p>
        </div>
      )}
    </div>
  );
}
