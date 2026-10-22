/**
 * Compile-time drift checks between the server's zod schemas and the client's
 * types. Checked by `nuxi typecheck` (the root tsconfig includes every file);
 * vitest does not run it (its include pattern is `*.test.ts`).
 */
import { expectTypeOf } from "vitest";
import type { z } from "zod";

import type { newResearchCardSchema, runStartBodySchema } from "~/server/utils/research-schemas";
import type { NewResearchCardInput, RunStartBody } from "~/types/research";

expectTypeOf<z.input<typeof runStartBodySchema>>().toEqualTypeOf<RunStartBody>();
expectTypeOf<z.input<typeof newResearchCardSchema>>().toEqualTypeOf<NewResearchCardInput>();
