export type PlacementQuestion = {
  id: string;
  skill: "grammar" | "vocabulary" | "listening" | "writing";
  /** 1 = easy, 2 = medium, 3 = hard — used for weighted scoring. */
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: "p1",
    skill: "grammar",
    difficulty: 1,
    prompt: "She ___ to the office every day.",
    options: ["go", "goes", "going", "gone"],
    correctIndex: 1,
    explanation: "He/she/it + verb with -s in the present simple: she goes.",
  },
  {
    id: "p2",
    skill: "grammar",
    difficulty: 1,
    prompt: "I have been living here ___ 2020.",
    options: ["for", "since", "from 2020 to", "during"],
    correctIndex: 1,
    explanation: "A starting point takes “since”; a duration takes “for”.",
  },
  {
    id: "p3",
    skill: "vocabulary",
    difficulty: 1,
    prompt: "Which word means “a place where planes take off and land”?",
    options: ["airport", "hospital", "station", "library"],
    correctIndex: 0,
    explanation: "airport = the place for flights.",
  },
  {
    id: "p4",
    skill: "grammar",
    difficulty: 2,
    prompt: "If it ___ tomorrow, we will stay in.",
    options: ["rains", "rain", "will rain", "rained"],
    correctIndex: 0,
    explanation: "First conditional: if + present simple, will + base verb.",
  },
  {
    id: "p5",
    skill: "grammar",
    difficulty: 2,
    prompt: "He didn't ___ the email before the meeting.",
    options: ["send", "sent", "sending", "sends"],
    correctIndex: 0,
    explanation: "After didn't, use the base verb: didn't send.",
  },
  {
    id: "p6",
    skill: "vocabulary",
    difficulty: 2,
    prompt: "Choose the natural collocation:",
    options: ["make a concern", "do a concern", "raise a concern", "build a concern"],
    correctIndex: 2,
    explanation: "English pairs raise with concern: raise a concern.",
  },
  {
    id: "p7",
    skill: "vocabulary",
    difficulty: 2,
    prompt: "Someone who is “meticulous” is…",
    options: ["very careful with details", "always in a hurry", "easily angry", "extremely generous"],
    correctIndex: 0,
    explanation: "meticulous = extremely careful and precise.",
  },
  {
    id: "p8",
    skill: "grammar",
    difficulty: 2,
    prompt: "The list of files ___ ready for review.",
    options: ["is", "are", "have", "were many"],
    correctIndex: 0,
    explanation: "The verb agrees with “list” (singular), not “files”.",
  },
  {
    id: "p9",
    skill: "writing",
    difficulty: 3,
    prompt: "Which sentence is the most natural professional email line?",
    options: [
      "Kindly do the needful and revert back to me.",
      "Could you send the updated report by Thursday?",
      "Do the needful fast.",
      "Revert me the report immediately.",
    ],
    correctIndex: 1,
    explanation: "Specific ask + deadline + natural phrasing — no “kindly revert”.",
  },
  {
    id: "p10",
    skill: "grammar",
    difficulty: 3,
    prompt: "___ I known earlier, I would have helped.",
    options: ["If", "Had", "Were", "Should"],
    correctIndex: 1,
    explanation: "Third conditional inversion: Had I known… (= If I had known).",
  },
  {
    id: "p11",
    skill: "vocabulary",
    difficulty: 3,
    prompt: "“Ubiquitous” means…",
    options: ["rare", "widespread / everywhere", "ancient", "broken"],
    correctIndex: 1,
    explanation: "ubiquitous = present or found everywhere.",
  },
  {
    id: "p12",
    skill: "grammar",
    difficulty: 3,
    prompt: "Not only ___ late, but he also forgot the files.",
    options: ["he was", "was he", "he is", "did he"],
    correctIndex: 1,
    explanation: "After “not only” at the start, invert subject and verb: was he.",
  },
];

export type PlacementLevel =
  | "complete_beginner"
  | "beginner"
  | "elementary"
  | "intermediate"
  | "upper_intermediate"
  | "advanced";

/** Difficulty (0..1) each level starts at — drives exercise selection. */
export const LEVEL_BASELINE: Record<PlacementLevel, number> = {
  complete_beginner: 0.25,
  beginner: 0.35,
  elementary: 0.45,
  intermediate: 0.55,
  upper_intermediate: 0.7,
  advanced: 0.85,
};

export const LEVEL_LABELS: Record<PlacementLevel, string> = {
  complete_beginner: "Complete beginner",
  beginner: "Beginner",
  elementary: "Elementary",
  intermediate: "Intermediate",
  upper_intermediate: "Upper-intermediate",
  advanced: "Advanced",
};

export type PlacementResult = {
  level: PlacementLevel;
  ratio: number;
  perSkill: Record<string, number>;
  correctCount: number;
  total: number;
};

/**
 * Weighted scoring: a correct hard question is worth more than a correct easy
 * one, so guessing the basics never inflates the level.
 */
export function scorePlacement(answers: number[]): PlacementResult {
  const total = PLACEMENT_QUESTIONS.length;
  const given = Math.min(answers.length, total);
  const weightSum = PLACEMENT_QUESTIONS.reduce((sum, q) => sum + q.difficulty, 0);

  let earned = 0;
  let correctCount = 0;
  const skillEarned: Record<string, number> = {};
  const skillTotal: Record<string, number> = {};

  PLACEMENT_QUESTIONS.forEach((q, i) => {
    skillTotal[q.skill] = (skillTotal[q.skill] ?? 0) + q.difficulty;
    const correct = i < given && answers[i] === q.correctIndex;
    if (correct) {
      earned += q.difficulty;
      correctCount += 1;
      skillEarned[q.skill] = (skillEarned[q.skill] ?? 0) + q.difficulty;
    }
  });

  const ratio = weightSum > 0 ? earned / weightSum : 0;

  const level: PlacementLevel =
    ratio < 0.4
      ? "complete_beginner"
      : ratio < 0.55
        ? "beginner"
        : ratio < 0.7
          ? "elementary"
          : ratio < 0.85
            ? "intermediate"
            : ratio < 0.95
              ? "upper_intermediate"
              : "advanced";

  const perSkill: Record<string, number> = {};
  for (const [skill, totalW] of Object.entries(skillTotal)) {
    perSkill[skill] = Math.round(((skillEarned[skill] ?? 0) / totalW) * 100);
  }

  return { level, ratio: Math.round(ratio * 100) / 100, perSkill, correctCount, total };
}
