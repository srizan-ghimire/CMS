"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { JSONContent } from "@tiptap/react";
import { isPostEditable, type MediaAssetDto, type SocialPlatform } from "@social-platform/shared";
import { roleAtLeast, useActiveWorkspace } from "@/hooks/use-workspace";
import {
  useCreatePost,
  usePost,
  usePostValidation,
  useSocialAccounts,
  useUpdatePost,
} from "@/hooks/use-posts";
import { useComposerStore } from "@/store/composer-store";
import { PostEditor } from "@/components/composer/post-editor";
import { AccountSelector } from "@/components/composer/account-selector";
import { CharacterCounter } from "@/components/composer/character-counter";
import { MediaStrip } from "@/components/composer/media-strip";
import { PlatformPreview } from "@/components/composer/platform-preview";
import { PlatformIcon, platformLabel } from "@/components/composer/platform-icon";
import { ComposerActions } from "@/components/composer/composer-actions";
import { CollaborationPanel } from "@/components/composer/collaboration-panel";
import { SnippetInserter } from "@/components/composer/snippet-inserter";
import { TagPicker } from "@/components/organization/tag-picker";
import { useAssignCampaign, useCampaigns, useSetTags } from "@/hooks/use-organization";
import { useSession } from "@/lib/auth-client";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/misc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ComposerPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <Composer />
    </Suspense>
  );
}

function Composer() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const postId = searchParams.get("id");

  const { workspaceId, role, isLoading: workspaceLoading } = useActiveWorkspace();
  const canEdit = roleAtLeast(role, "EDITOR");

  const { data: accounts } = useSocialAccounts(workspaceId);
  const { data: post, isLoading: postLoading } = usePost(postId);
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();

  const store = useComposerStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [attached, setAttached] = useState<MediaAssetDto[]>([]);
  const loadedFor = useRef<string | null>(null);

  const editable = !post || isPostEditable(post.status);

  // Hydrate the local buffer once per post. Re-running on every `post` change would overwrite
  // whatever the user typed while an autosave was in flight.
  useEffect(() => {
    if (postId && post && loadedFor.current !== post.id) {
      loadedFor.current = post.id;
      setAttached(post.media);
      setTagIds(post.tags.map((t) => t.id));
      store.load({
        postId: post.id,
        title: post.title ?? "",
        contentJson: (post.contentJson as JSONContent | null) ?? null,
        contentText: post.content,
        firstComment: post.firstComment ?? "",
        mediaAssetIds: post.media.map((m) => m.id),
        targets: post.targets.map((t) => ({
          socialAccountId: t.socialAccountId,
          contentOverride: t.contentOverride,
          contentJsonOverride: null,
          mediaAssetIds: t.mediaAssetIds.length ? t.mediaAssetIds : null,
        })),
        scheduledAt: post.scheduledAt,
      });
    }
    if (!postId && loadedFor.current !== null) {
      loadedFor.current = null;
      store.reset();
      setAttached([]);
      setTagIds([]);
    }
  }, [postId, post, store]);

  const selectedAccountIds = store.targets.map((t) => t.socialAccountId);
  const selectedAccounts = (accounts ?? []).filter((a) => selectedAccountIds.includes(a.id));
  const selectedPlatforms = useMemo(
    () => Array.from(new Set(selectedAccounts.map((a) => a.platform as SocialPlatform))),
    [selectedAccounts],
  );

  const { data: validation } = usePostValidation(store.postId, Boolean(store.postId));
  const blocking = (validation ?? []).filter((v) => !v.ok);

  const { data: session } = useSession();
  const { data: campaigns } = useCampaigns(workspaceId);
  const setTags = useSetTags("posts");
  const assignCampaign = useAssignCampaign();
  // Tags and campaign are saved immediately on change rather than via the draft autosave: they
  // live on their own endpoints, so batching them into the post PATCH would mean a second
  // round-trip anyway.
  const [tagIds, setTagIds] = useState<string[]>([]);

  const buildPayload = useCallback(
    () => ({
      title: store.title || null,
      content: store.contentText,
      contentJson: store.contentJson,
      firstComment: store.firstComment || null,
      mediaAssetIds: store.mediaAssetIds,
      targets: store.targets.map((t) => ({
        socialAccountId: t.socialAccountId,
        contentOverride: t.contentOverride,
        contentJsonOverride: t.contentJsonOverride,
        mediaAssetIds: t.mediaAssetIds ?? undefined,
      })),
      scheduledAt: store.scheduledAt,
    }),
    [store],
  );

  const save = useCallback(
    async (silent: boolean) => {
      if (!workspaceId || !canEdit) return null;
      try {
        if (store.postId) {
          const saved = await updatePost.mutateAsync({ id: store.postId, input: buildPayload() });
          store.markClean();
          if (!silent) toast.success("Draft saved");
          return saved;
        }
        const created = await createPost.mutateAsync({
          workspaceId,
          timezone: "UTC",
          ...buildPayload(),
        });
        store.markClean();
        // Put the new id in the URL so a reload resumes the same draft instead of starting over.
        router.replace(`/composer?id=${created.id}`);
        if (!silent) toast.success("Draft created");
        return created;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save");
        return null;
      }
    },
    [workspaceId, canEdit, store, buildPayload, updatePost, createPost, router],
  );

  // Debounced autosave. Only fires for an existing draft — creating one on the first keystroke
  // would litter the content list with empty posts.
  useEffect(() => {
    if (!store.isDirty || !store.postId || !editable) return;
    const timer = setTimeout(() => void save(true), 1200);
    return () => clearTimeout(timer);
  }, [store.isDirty, store.postId, store.contentText, store.title, editable, save]);

  const reorderMedia = (from: number, to: number) => {
    const next = [...store.mediaAssetIds];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    store.setMediaAssetIds(next);
    setAttached((current) => {
      const copy = [...current];
      const [item] = copy.splice(from, 1);
      if (item) copy.splice(to, 0, item);
      return copy;
    });
  };

  if (workspaceLoading || (postId && postLoading)) return <Skeleton className="h-96 w-full" />;
  if (!workspaceId) {
    return <p className="text-muted-foreground text-sm">Create a workspace to start composing.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{store.postId ? "Edit post" : "New post"}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Write once, tailor per platform, then schedule or publish.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">
            {updatePost.isPending || createPost.isPending ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            ) : store.isDirty ? (
              "Unsaved changes"
            ) : store.postId ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" /> Saved
              </span>
            ) : null}
          </span>
          <Button
            variant="outline"
            onClick={() => void save(false)}
            disabled={!canEdit || !editable}
          >
            Save draft
          </Button>
        </div>
      </div>

      {editable && canEdit && (
        <ComposerActions
          post={post ?? null}
          hasBlockingErrors={blocking.length > 0}
          canPublish={roleAtLeast(role, "MANAGER")}
          onSaveFirst={() => save(true)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: ["posts"] })}
        />
      )}

      {!editable && (
        <p className="border-warning/40 bg-warning/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <AlertTriangle className="text-warning h-4 w-4" />
          This post is {post?.status.toLowerCase().replace("_", " ")} and can no longer be edited.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title (internal only)</Label>
            <Input
              id="title"
              value={store.title}
              onChange={(e) => store.setTitle(e.target.value)}
              placeholder="Name this post so you can find it later"
              disabled={!editable}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Publish to</Label>
            <AccountSelector
              accounts={accounts ?? []}
              selectedIds={selectedAccountIds}
              onToggle={store.toggleTarget}
              disabled={!editable}
            />
          </div>

          <Tabs defaultValue="shared">
            <TabsList>
              <TabsTrigger value="shared">Shared content</TabsTrigger>
              {selectedAccounts.map((account) => (
                <TabsTrigger key={account.id} value={account.id} className="gap-1.5">
                  <PlatformIcon
                    platform={account.platform as SocialPlatform}
                    className="h-3.5 w-3.5"
                  />
                  <span className="max-w-[90px] truncate">{account.displayName}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="shared" className="space-y-3">
              <PostEditor
                content={store.contentJson}
                onChange={store.setContent}
                editable={editable}
              />
              <div className="flex items-center justify-between">
                <CharacterCounter text={store.contentText} platforms={selectedPlatforms} />
              </div>

              <MediaStrip
                assets={attached}
                onAdd={() => setPickerOpen(true)}
                onRemove={(id) => {
                  store.setMediaAssetIds(store.mediaAssetIds.filter((m) => m !== id));
                  setAttached((current) => current.filter((a) => a.id !== id));
                }}
                onReorder={reorderMedia}
                disabled={!editable}
              />

              <div className="space-y-1.5">
                <Label htmlFor="firstComment">First comment (optional)</Label>
                <Textarea
                  id="firstComment"
                  value={store.firstComment}
                  onChange={(e) => store.setFirstComment(e.target.value)}
                  placeholder="Hashtags often go here rather than in the caption"
                  disabled={!editable}
                  className="min-h-[60px]"
                />
                <SnippetInserter
                  workspaceId={workspaceId}
                  disabled={!editable}
                  onInsert={(body) =>
                    store.setFirstComment(
                      store.firstComment
                        ? `${store.firstComment}
${body}`
                        : body,
                    )
                  }
                />
              </div>

              <div className="border-border flex flex-wrap items-center gap-3 border-t pt-3">
                <TagPicker
                  workspaceId={workspaceId}
                  selectedIds={tagIds}
                  disabled={!editable || !store.postId}
                  onChange={(next) => {
                    setTagIds(next);
                    if (store.postId) setTags.mutate({ id: store.postId, tagIds: next });
                  }}
                />

                <Select
                  value={post?.campaignId ?? "none"}
                  disabled={!editable || !store.postId}
                  onValueChange={(value) =>
                    store.postId &&
                    assignCampaign.mutate({
                      postId: store.postId,
                      campaignId: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-[200px]">
                    <SelectValue placeholder="No campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No campaign</SelectItem>
                    {(campaigns ?? []).map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {!store.postId && (
                  <span className="text-muted-foreground text-xs">
                    Save the draft first to tag it.
                  </span>
                )}
              </div>
            </TabsContent>

            {selectedAccounts.map((account) => {
              const target = store.targets.find((t) => t.socialAccountId === account.id);
              const overriding =
                target?.contentOverride !== null && target?.contentOverride !== undefined;
              return (
                <TabsContent key={account.id} value={account.id} className="space-y-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!overriding}
                      disabled={!editable}
                      onChange={(e) =>
                        store.setTargetOverride(
                          account.id,
                          e.target.checked ? null : store.contentJson,
                          e.target.checked ? null : store.contentText,
                        )
                      }
                    />
                    Use the shared content
                  </label>

                  {overriding && (
                    <>
                      <PostEditor
                        content={target?.contentJsonOverride ?? null}
                        onChange={(doc, text) => store.setTargetOverride(account.id, doc, text)}
                        editable={editable}
                        compact
                        placeholder={`Write a ${platformLabel(account.platform as SocialPlatform)}-specific version`}
                      />
                      <CharacterCounter
                        text={target?.contentOverride ?? ""}
                        platforms={[account.platform as SocialPlatform]}
                      />
                    </>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>

          {blocking.length > 0 && (
            <div className="border-destructive/40 bg-destructive/5 space-y-1.5 rounded-md border px-3 py-2">
              <p className="text-destructive flex items-center gap-2 text-sm font-medium">
                <AlertTriangle className="h-4 w-4" />
                Fix before publishing
              </p>
              <ul className="text-destructive ml-6 list-disc space-y-0.5 text-sm">
                {blocking.flatMap((target) =>
                  target.errors.map((error) => (
                    <li key={`${target.socialAccountId}-${error}`}>{error}</li>
                  )),
                )}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <p className="text-sm font-medium">Preview</p>
          {selectedAccounts.length === 0 ? (
            <p className="border-border text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-sm">
              Select an account to see a preview.
            </p>
          ) : (
            selectedAccounts.map((account) => {
              const target = store.targets.find((t) => t.socialAccountId === account.id);
              return (
                <PlatformPreview
                  key={account.id}
                  platform={account.platform as SocialPlatform}
                  accountName={account.displayName}
                  accountHandle={account.handle}
                  accountAvatarUrl={account.avatarUrl}
                  content={target?.contentOverride ?? store.contentText}
                  media={attached}
                />
              );
            })
          )}
        </aside>
      </div>

      {store.postId && session?.user?.id && (
        <div className="border-border border-t pt-5">
          <CollaborationPanel
            postId={store.postId}
            currentUserId={session.user.id}
            canApprove={roleAtLeast(role, "MANAGER")}
            onRestored={() => {
              // The local buffer now holds stale text; force a clean reload of the post.
              loadedFor.current = null;
              void queryClient.invalidateQueries({ queryKey: ["post", store.postId] });
            }}
          />
        </div>
      )}

      {pickerOpen && (
        <MediaPickerDialog
          workspaceId={workspaceId}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          alreadySelectedIds={store.mediaAssetIds}
          onConfirm={(assets) => {
            setAttached((current) => [...current, ...assets]);
            store.setMediaAssetIds([...store.mediaAssetIds, ...assets.map((a) => a.id)]);
          }}
        />
      )}
    </div>
  );
}
