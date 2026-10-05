export type ListeningQuestion = {
  id: number;
  type: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type ListeningAnswer = number | null;

export type PublicListeningQuestion = {
  id: number;
  type: string;
  prompt: string;
  options: string[];
};

export type ListeningQuestionResult = {
  questionId: number;
  correct: boolean;
  correctIndex: number;
  explanation: string;
};

export type ListeningGrade = {
  score: number;
  correctCount: number;
  total: number;
  results: ListeningQuestionResult[];
};

/** Server-side grading: answers are index-aligned with orderIndex-sorted questions. */
export function gradeListening(
  questions: ListeningQuestion[],
  answers: ListeningAnswer[]
): ListeningGrade {
  const results: ListeningQuestionResult[] = questions.map((q, i) => {
    const given = answers[i];
    const correct =
      typeof given === "number" &&
      Number.isInteger(given) &&
      given >= 0 &&
      given < q.options.length &&
      given === q.correctIndex;
    return {
      questionId: q.id,
      correct,
      correctIndex: q.correctIndex,
      explanation: q.explanation,
    };
  });
  const total = questions.length;
  const correctCount = results.filter((r) => r.correct).length;
  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  return { score, correctCount, total, results };
}

/** Strips answer keys before sending questions to the client. */
export function toPublicQuestions(questions: ListeningQuestion[]): PublicListeningQuestion[] {
  return questions.map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    options: q.options,
  }));
}
