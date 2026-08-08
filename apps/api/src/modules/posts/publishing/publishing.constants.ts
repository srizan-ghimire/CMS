/**
 * Queue/job names live here, with no imports of their own, so publishing.service.ts and
 * publish.processor.ts never have to import each other. They previously did — the service pulled
 * the constants from the processor while the processor injected the service — and that cycle left
 * the service token `undefined` at decoration time, so Nest could not resolve PublishProcessor.
 *
 * No colons: BullMQ uses ":" as its Redis key separator and rejects queue names containing one.
 */
export const PUBLISH_QUEUE = "posts-publish";
export const PUBLISH_JOB = "publish-target";

export interface PublishJobData {
  targetId: string;
}
