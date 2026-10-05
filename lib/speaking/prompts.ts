/** Free-talk prompts shown when the learner doesn't pick a scenario. */
export const FREE_TOPICS = [
  "Describe your day so far, from waking up to now.",
  "Talk about a trip you'll never forget.",
  "Explain your job or studies to someone outside your field.",
  "What makes a good friend? Use a real example.",
  "Describe a skill you'd love to learn this year — and why.",
  "Compare your city to the place you'd most like to live.",
  "Tell a short story about something that went wrong today.",
  "Give your past self one piece of advice.",
];

export function topicForIndex(index: number): string {
  return FREE_TOPICS[((index % FREE_TOPICS.length) + FREE_TOPICS.length) % FREE_TOPICS.length];
}
