import { accountExists } from "~/server/utils/settings";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const name = query.name as string | undefined;

  if (!name) {
    throw createError({
      statusCode: 400,
      message: "name query parameter is required",
    });
  }

  const exists = await accountExists(name);
  return { available: !exists };
});
