import type {
  NewResearchCardInput,
  NewResearchCardResponse,
  ResearchCardList,
  ResearchStatus,
} from "~/types/research";

/**
 * Composable for the fwbg research register: list cards, register a new one.
 */
export function useResearch() {
  /** Cards with the given status; active by default (the cards a run may use). */
  async function listCards(status: ResearchStatus = "active"): Promise<ResearchCardList> {
    return $fetch<ResearchCardList>("/api/research", { query: { status } });
  }

  /** Never retry on a `warning`: the card was written and only its commit failed. */
  async function createCard(input: NewResearchCardInput): Promise<NewResearchCardResponse> {
    return $fetch<NewResearchCardResponse>("/api/research", {
      method: "POST",
      body: input,
    });
  }

  return { listCards, createCard };
}
