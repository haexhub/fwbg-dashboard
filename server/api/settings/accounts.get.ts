import { listAccountFolders } from "~/server/utils/settings";

export default defineEventHandler(async () => {
  const accounts = await listAccountFolders();
  return { accounts };
});
