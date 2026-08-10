"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  PenSquare,
  Plus,
} from "lucide-react";
import { apiClient, toQuery } from "@/lib/api-client";
import { useActiveWorkspace } from "@/hooks/use-workspace";
import { CreateWorkspaceDialog } from "@/components/dashboard/create-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/misc";
import { AnimatedNumber, Stagger, StaggerItem } from "@/components/ui/motion";

interface Overview {
  totals: {
    posts: number;
    published: number;
    scheduled: number;
    drafts: number;
    awaitingApproval: number;
    failed: number;
    mediaAssets: number;
  };
  delivery: {
    attempted: number;
    succeeded: number;
    failed: number;
    skipped: number;
    successRate: number;
  };
  recentFailures: {
    postId: string;
    title: string;
    platform: string;
    accountName: string;
    errorMessage: string | null;
  }[];
}

export default function DashboardPage() {
  const { workspaceId, workspace, isLoading } = useActiveWorkspace();

  const { data } = useQuery({
    queryKey: ["analytics-overview", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: () => apiClient.get<Overview>(`/analytics/overview${toQuery({ workspaceId })}`),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!workspaceId) {
    return (
      <div className="border-border mx-auto max-w-md rounded-md border border-dashed px-6 py-14 text-center">
        <Building2 className="text-muted-foreground mx-auto h-6 w-6" />
        <h1 className="mt-4 text-lg font-semibold">Create your first workspace</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-relaxed">
          A workspace holds your connected accounts, posts and media. You need one before you can
          connect a social account or write anything.
        </p>
        <CreateWorkspaceDialog>
          <Button className="mt-6">
            <Plus />
            New workspace
          </Button>
        </CreateWorkspaceDialog>
      </div>
    );
  }

  const tiles = [
    {
      label: "Drafts",
      value: data?.totals.drafts ?? 0,
      icon: FileText,
      href: "/content?status=DRAFT",
    },
    {
      label: "Scheduled",
      value: data?.totals.scheduled ?? 0,
      icon: CalendarClock,
      href: "/calendar",
    },
    {
      label: "Published",
      value: data?.totals.published ?? 0,
      icon: CheckCircle2,
      href: "/content?status=PUBLISHED",
    },
    { label: "Media", value: data?.totals.mediaAssets ?? 0, icon: ImageIcon, href: "/media" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{workspace?.name ?? "Dashboard"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            What is in flight across this workspace.
          </p>
        </div>
        <Button asChild>
          <Link href="/composer">
            <PenSquare className="h-4 w-4" />
            New post
          </Link>
        </Button>
      </div>

      <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, href }) => (
          <StaggerItem key={label}>
            <Link href={href} className="group block">
              <Card className="group-hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className="text-muted-foreground group-hover:text-primary h-5 w-5 transition-colors" />
                  <div>
                    <AnimatedNumber
                      value={value}
                      className="block text-2xl font-semibold tabular-nums"
                    />
                    <p className="text-muted-foreground text-xs">{label}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Publish reliability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.delivery.attempted ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing published yet.</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    {data?.delivery.successRate}%
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {data?.delivery.succeeded} of {data?.delivery.attempted} deliveries
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-success h-full"
                    style={{ width: `${data?.delivery.successRate ?? 0}%` }}
                  />
                </div>
                {(data?.delivery.skipped ?? 0) > 0 && (
                  <p className="text-muted-foreground text-xs">
                    {data?.delivery.skipped} skipped by platform validation
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="text-warning h-4 w-4" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(data?.recentFailures.length ?? 0) === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing failing.</p>
            ) : (
              <ul className="space-y-2">
                {data?.recentFailures.slice(0, 4).map((failure, i) => (
                  <li key={`${failure.postId}-${i}`} className="text-sm">
                    <Link
                      href={`/composer?id=${failure.postId}`}
                      className="font-medium hover:underline"
                    >
                      {failure.title}
                    </Link>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="destructive">{failure.platform.toLowerCase()}</Badge>
                      <span className="text-muted-foreground truncate text-xs">
                        {failure.errorMessage ?? "failed"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {(data?.totals.awaitingApproval ?? 0) > 0 && (
        <Link href="/approvals" className="block">
          <Card className="border-warning/40 bg-warning/5 hover:border-warning transition-colors">
            <CardContent className="p-4 text-sm">
              <span className="font-medium">{data?.totals.awaitingApproval}</span> post
              {data?.totals.awaitingApproval === 1 ? "" : "s"} awaiting approval.
            </CardContent>
          </Card>
        </Link>
      )}
    </div>
  );
}
