import { BadRequestException, Injectable, type PipeTransform } from "@nestjs/common";
import { z, ZodTypeAny } from "zod";

/**
 * Validates a handler argument against a Zod schema from `@social-platform/shared`, so the
 * client-side form resolver and the server-side check are literally the same object.
 *
 * Coexists with the global `ValidationPipe` in main.ts rather than replacing it: that pipe skips
 * any argument whose design-time type is `Object` (which is what a `z.infer<>` type alias compiles
 * down to), so class-based DTOs keep working untouched.
 *
 * Generic over the *schema* rather than over an output type, because schemas using `.default()`
 * or `.transform()` have different input and output types — `ZodSchema<T>` forces them equal and
 * rejects exactly the query schemas we need it for.
 *
 * Cost: Swagger can no longer derive the request body from a class. Annotate routes with
 * `@ApiBody({ schema: ... })` where the documented shape matters.
 */
@Injectable()
export class ZodValidationPipe<S extends ZodTypeAny> implements PipeTransform<unknown, z.infer<S>> {
  constructor(private readonly schema: S) {}

  transform(value: unknown): z.infer<S> {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: "Validation failed",
        message: result.error.issues.map(
          (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
        ),
      });
    }
    return result.data;
  }
}

/** Sugar so routes read `@Body(zodPipe(createPostSchema))`. Works for `@Query` too. */
export const zodPipe = <S extends ZodTypeAny>(schema: S) => new ZodValidationPipe(schema);
