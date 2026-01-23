import { getAccount, toggleAccountActive } from "../../../utils/ig-client";

/**
 * POST /api/accounts/:id/toggle
 * Toggle account active state
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({
      statusCode: 400,
      message: "Account ID is required",
    });
  }

  // Check if account exists
  const account = await getAccount(id);
  if (!account) {
    throw createError({
      statusCode: 404,
      message: `Account not found: ${id}`,
    });
  }

  // Toggle the active state
  const newActiveState = !account.isActive;
  const updatedAccount = await toggleAccountActive(id, newActiveState);

  if (!updatedAccount) {
    throw createError({
      statusCode: 500,
      message: "Failed to update account",
    });
  }

  return {
    success: true,
    account: {
      id: updatedAccount.id,
      name: updatedAccount.name,
      isActive: updatedAccount.isActive,
      accType: updatedAccount.credentials?.acc_type || "UNKNOWN",
    },
  };
});
