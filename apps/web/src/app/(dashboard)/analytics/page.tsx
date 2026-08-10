"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import type { SocialPlatform } from "@social-platform/shared";
import { apiClient, toQuery } from "@/lib/api-client";
import { useActiveWorkspace } from "@/hooks/use-workspace";
import { PlatformIcon, platformLabel } from "@/components/composer/platform-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { AnimatedNumber, DURATION, EASE, motion, useReducedMotion } from "@/components/ui/motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Overview {
  totals: Record<string, number>;
  delivery: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    successRate: number;
  };
  byPlatform: { platform: string; published: number; failed: number }[];
  timeline: { date: string; published: number }[];
  topCampaigns: { id: string; name: string; postCount: number; publishedCount: number }[];
  recentFailures: {
    postId: string;
    title: string;
    platform: string;
    accountName: string;
    errorMessage: string | null;
    attempts: number;
  }[];
}

export default function AnalyticsPage() {
  const { workspaceId, isLoading } = useActiveWorkspace();
  const [days, setDays] = useState("30");

  const { data } = useQuery({
    queryKey: ["analytics-overview", workspaceId, days],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<Overview>(`/analytics/overview${toQuery({ workspaceId, days })}`),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!workspaceId) {
    return <p className="text-muted-foreground text-sm">Create a workspace first.</p>;
  }

  const peak = Math.max(1, ...(data?.timeline ?? []).map((d) => d.published));
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Content volume and delivery reliability, from this platform&apos;s own publish record.
          </p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stated plainly rather than shown as an empty chart: engagement metrics need each
          platform's insights API, which this deployment does not poll. */}
      <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
        Reach, impressions and engagement are not shown — they require polling each platform&apos;s
        insights API, which this deployment does not do.
      </p>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Posts published per day</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.timeline ?? []).every((d) => d.published === 0) ? (
              <p className="text-muted-foreground py-8 text-center text-sm">
                Nothing published in this window.
              </p>
            ) : (
              <div className="flex h-40 items-end gap-px">
                {data?.timeline.map((day, index) => (
                  <motion.div
                    key={day.date}
                    className="bg-primary/20 hover:bg-primary/40 group relative flex-1 origin-bottom transition-colors"
                    style={{ height: `${Math.max(2, (day.published / peak) * 100)}%` }}
                    title={`${day.date}: ${day.published}`}
                    // Bars grow from the axis, left to right, so the chart reads as being drawn.
                    // The cap keeps a 90-day window from taking three seconds to finish.
                    {...(reduceMotion
                      ? {}
                      : {
                          initial: { scaleY: 0 },
                          animate: { scaleY: 1 },
                          transition: {
                            duration: DURATION.entrance,
                            delay: Math.min(index * 0.012, 0.5),
                            ease: EASE,
                          },
                        })}
                  >
                    <span className="bg-popover pointer-events-none absolute -top-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded px-1 text-[10px] shadow group-hover:block">
                      {day.published}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Succeeded" value={data?.delivery.succeeded ?? 0} />
            <Row label="Failed" value={data?.delivery.failed ?? 0} />
            <Row label="Skipped (validation)" value={data?.delivery.skipped ?? 0} />
            <div className="border-border border-t pt-2">
              <Row label="Success rate" value={`${data?.delivery.successRate ?? 0}%`} bold />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By platform</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.byPlatform.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No deliveries yet.</p>
            ) : (
              <ul className="space-y-2">
                {data?.byPlatform.map((row) => (
                  <li key={row.platform} className="flex items-center gap-2 text-sm">
                    <PlatformIcon
                      platform={row.platform as SocialPlatform}
                      className="text-muted-foreground h-4 w-4"
                    />
                    <span className="flex-1">{platformLabel(row.platform as SocialPlatform)}</span>
                    <span className="tabular-nums">{row.published}</span>
                    {row.failed > 0 && <Badge variant="destructive">{row.failed} failed</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.topCampaigns.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">No campaigns yet.</p>
            ) : (
              <ul className="space-y-2">
                {data?.topCampaigns.map((campaign) => (
                  <li key={campaign.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{campaign.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {campaign.publishedCount}/{campaign.postCount}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(data?.recentFailures.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recent failures</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data?.recentFailures.map((failure, i) => (
                <li key={`${failure.postId}-${i}`} className="text-sm">
                  <Link
                    href={`/composer?id=${failure.postId}`}
                    className="font-medium hover:underline"
                  >
                    {failure.title}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {failure.accountName} · {failure.errorMessage ?? "failed"} ({failure.attempts}{" "}
                    attempt{failure.attempts === 1 ? "" : "s"})
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number | string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-semibold tabular-nums" : "tabular-nums"}>
        {typeof value === "number" ? <AnimatedNumber value={value} /> : value}
      </span>
    </div>
  );
}
