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
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { features } from "@/config/features";
import { useRouter } from "next/navigation";

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
  const debouncedSearch = useDebounce(searchQuery);

  const { data: filters } = trpc.experts.listFilters.useQuery();

  const { data: experts, isLoading } = trpc.experts.search.useQuery({
    query: debouncedSearch || undefined,
    specialization: specialization && specialization !== "all" ? specialization : undefined,
    country: country && country !== "all" ? country : undefined,
    language: language && language !== "all" ? language : undefined,
  });

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
            <SelectTrigger className="w-full sm:w-[160px]">
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
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Country" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {filters?.countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
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
                <SelectItem key={l} value={l}>
                  {l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : experts && experts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experts.map((expert) => (
            <Card key={expert.id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4 sm:p-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base">{expert.name}</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">{expert.title}</p>
                  <p className="text-xs text-primary">{expert.firm}</p>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">{expert.bio}</p>

                <div className="flex flex-wrap gap-1.5">
                  {expert.specializations.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {expert.location.city}, {expert.location.country}
                  </span>
                  {expert.certifications && expert.certifications.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      {expert.certifications.join(", ")}
                    </span>
                  )}
                </div>

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
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            {debouncedSearch ||
            (specialization && specialization !== "all") ||
            (country && country !== "all") ||
            (language && language !== "all")
              ? "No experts found matching your criteria. Try adjusting your filters."
              : "No experts available at this time."}
          </p>
        </div>
      )}
    </div>
  );
}
