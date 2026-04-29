"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Mail,
  Award,
  Loader2,
  CheckCircle2,
  Globe,
  Clock,
  MessageSquare,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useDebounce } from "@/hooks/use-debounce";
import { features } from "@/config/features";
import { useRouter, useSearchParams } from "next/navigation";
import { ExpertContactDialog } from "@/components/privacy/expert-contact-dialog";
import { useOrganization } from "@/lib/organization-context";
import { ExpertEngagementStatus } from "@prisma/client";

const PAGE_SIZE = 20;

export default function ExpertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("experts");
  const tEng = useTranslations("experts.engagements");
  const { organization } = useOrganization();

  const [searchQuery, setSearchQuery] = useState("");
  const [specialization, setSpecialization] = useState<string>(
    searchParams.get("specialization") ?? ""
  );
  const [country, setCountry] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [expertType, setExpertType] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [contactExpert, setContactExpert] = useState<{ id: string; name: string } | null>(null);
  const debouncedSearch = useDebounce(searchQuery);

  // Redirect if feature is disabled
  useEffect(() => {
    if (!features.expertDirectoryEnabled) {
      router.replace("/privacy");
    }
  }, [router]);

  // Reset pagination when filters change
  useEffect(() => {
    setOffset(0);
  }, [debouncedSearch, specialization, country, language, expertType]);

  if (!features.expertDirectoryEnabled) return null;

  const { data: filters } = trpc.experts.listFilters.useQuery();

  const selectedExpertType = expertType && expertType !== "all"
    ? (expertType as "legal" | "technical" | "deployment")
    : undefined;

  const { data: searchResult, isLoading } = trpc.experts.search.useQuery({
    query: debouncedSearch || undefined,
    specialization: specialization && specialization !== "all" ? specialization : undefined,
    country: country && country !== "all" ? country : undefined,
    language: language && language !== "all" ? language : undefined,
    expertType: selectedExpertType,
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

  const expertTypeLabel = (et: string) => {
    if (et === "legal") return t("typeLegal");
    if (et === "technical") return t("typeTechnical");
    if (et === "deployment") return t("typeDeployment");
    return et;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("subtitle")}
        </p>
      </div>

      <Tabs defaultValue="directory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="directory">{tEng("tabDirectory")}</TabsTrigger>
          <TabsTrigger value="history">{tEng("tabHistory")}</TabsTrigger>
        </TabsList>
        <TabsContent value="directory" className="space-y-4">

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Select value={specialization} onValueChange={setSpecialization}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("specialization")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allSpecializations")}</SelectItem>
              {filters?.specializations.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={expertType} onValueChange={setExpertType}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder={t("expertType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              {filters?.expertTypes.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>
                  {ft.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder={t("country")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCountries")}</SelectItem>
              {filters?.countries.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="w-full sm:w-[140px]">
              <SelectValue placeholder={t("language")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allLanguages")}</SelectItem>
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
          {t("showing", { count: Math.min(offset + PAGE_SIZE, total), total })}
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
                        {expert.name ?? t("unnamedExpert")}
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground truncate">
                        {expert.title ?? t("privacyExpert")}
                      </p>
                      {expert.firm && (
                        <p className="text-xs text-primary truncate">{expert.firm}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {expert.expertTypes.map((et: string) => (
                        <Badge key={et} variant="outline" className="text-[10px]">
                          {expertTypeLabel(et)}
                        </Badge>
                      ))}
                      {expert.acceptingClients && (
                        <span className="flex items-center gap-1 text-[10px] text-green-600">
                          <CheckCircle2 className="w-3 h-3" />
                          {t("available")}
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

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() =>
                      setContactExpert({
                        id: expert.id,
                        name: expert.name ?? t("unnamedExpert"),
                      })
                    }
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {t("contactExpert")}
                  </Button>
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
                  {t("previous")}
                </Button>
              )}
              {hasMore && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                >
                  {t("next")}
                </Button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Search className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            {hasFilters ? t("noResults") : t("noExperts")}
          </p>
        </div>
      )}

        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <EngagementHistory orgId={organization?.id ?? ""} />
        </TabsContent>
      </Tabs>

      {contactExpert && (
        <ExpertContactDialog
          open={!!contactExpert}
          onOpenChange={(open) => { if (!open) setContactExpert(null); }}
          expertId={contactExpert.id}
          expertName={contactExpert.name}
        />
      )}
    </div>
  );
}

const STATUS_TONE: Record<ExpertEngagementStatus, string> = {
  CONTACTED: "border-muted-foreground text-muted-foreground",
  RESPONDED: "border-primary text-primary",
  ENGAGED: "border-primary bg-primary text-primary-foreground",
  COMPLETED: "border-green-500 text-green-600",
  DECLINED: "border-muted-foreground text-muted-foreground",
};

function EngagementHistory({ orgId }: { orgId: string }) {
  const tEng = useTranslations("experts.engagements");
  const utils = trpc.useUtils();
  const { data: engagements, isLoading } = trpc.experts.listEngagements.useQuery(
    { organizationId: orgId },
    { enabled: !!orgId }
  );

  const updateEngagement = trpc.experts.updateEngagement.useMutation({
    onSuccess: () => utils.experts.listEngagements.invalidate(),
  });

  const [editingNotesFor, setEditingNotesFor] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");

  if (!orgId) return null;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!engagements || engagements.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">{tEng("empty")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {engagements.map((eng) => {
        const isEditing = editingNotesFor === eng.id;
        return (
          <Card key={eng.id}>
            <CardContent className="py-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{eng.expertName}</span>
                    {eng.expertFirm && (
                      <span className="text-xs text-muted-foreground">— {eng.expertFirm}</span>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[eng.status]}`}>
                      {tEng(`status.${eng.status}`)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{eng.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {tEng("contactedBy", {
                      name: eng.contactedBy.name || eng.contactedBy.email,
                      date: new Date(eng.contactedAt).toLocaleDateString(),
                    })}
                  </p>
                </div>
                <Select
                  value={eng.status}
                  onValueChange={(value) =>
                    updateEngagement.mutate({
                      organizationId: orgId,
                      engagementId: eng.id,
                      status: value as ExpertEngagementStatus,
                    })
                  }
                >
                  <SelectTrigger className="w-[160px] shrink-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_TONE) as ExpertEngagementStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>{tEng(`status.${s}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {eng.message && (
                <div className="text-xs text-muted-foreground border-l-2 border-muted pl-3 line-clamp-3">
                  {eng.message}
                </div>
              )}

              {isEditing ? (
                <div className="space-y-2">
                  <Textarea
                    rows={3}
                    placeholder={tEng("notesPlaceholder")}
                    value={draftNotes}
                    onChange={(e) => setDraftNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        updateEngagement.mutate({
                          organizationId: orgId,
                          engagementId: eng.id,
                          notes: draftNotes,
                        });
                        setEditingNotesFor(null);
                      }}
                    >
                      {tEng("saveNotes")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingNotesFor(null)}>
                      {tEng("cancelNotes")}
                    </Button>
                  </div>
                </div>
              ) : eng.notes ? (
                <button
                  type="button"
                  className="text-left w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => {
                    setEditingNotesFor(eng.id);
                    setDraftNotes(eng.notes ?? "");
                  }}
                >
                  <span className="font-medium">{tEng("notes")}:</span> {eng.notes}
                </button>
              ) : (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => {
                    setEditingNotesFor(eng.id);
                    setDraftNotes("");
                  }}
                >
                  + {tEng("addNotes")}
                </button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
