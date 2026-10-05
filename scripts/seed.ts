import { createD1HttpClient } from "../lib/db/d1-http";
import { loadEnv } from "./load-env";

import { courses } from "../lib/content/courses";
import { lessons } from "../lib/content/lessons";
import { exercises } from "../lib/content/exercises";
import { vocabulary } from "../lib/content/vocabulary";
import { scenarios } from "../lib/content/scenarios";
import { podcasts } from "../lib/content/podcasts";
import { mistakes } from "../lib/content/mistakes";
import { achievements } from "../lib/content/achievements";

loadEnv();

const q = (v: string) => `'${v.replace(/'/g, "''")}'`;

function lit(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  if (typeof v === "object") return q(JSON.stringify(v));
  return q(String(v));
}

const now = () => Date.now();

type Row = Record<string, unknown>;

function insert(table: string, row: Row): string {
  const keys = Object.keys(row);
  return `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((k) => lit(row[k])).join(", ")})`;
}

/** Insert, or update content columns when the conflict target already exists. */
function upsert(table: string, row: Row, conflict: string[]): string {
  const keys = Object.keys(row);
  const updates = keys.filter((k) => !conflict.includes(k));
  const setClause =
    updates.length > 0
      ? updates.map((k) => `${k} = excluded.${k}`).join(", ")
      : keys.map((k) => `${k} = ${k}`).join(", ");
  return (
    `INSERT INTO ${table} (${keys.join(", ")}) VALUES (${keys.map((k) => lit(row[k])).join(", ")}) ` +
    `ON CONFLICT (${conflict.join(", ")}) DO UPDATE SET ${setClause}`
  );
}

/** difficulty is stored 0..1 — content authors write 1..3. */
const normDifficulty = (d: number) => Math.round((d / 4) * 1000) / 1000;

async function runChunks(client: ReturnType<typeof createD1HttpClient>, statements: string[], label: string) {
  const CHUNK = 25;
  for (let i = 0; i < statements.length; i += CHUNK) {
    const slice = statements.slice(i, i + CHUNK);
    await client.exec(slice.join(";\n"));
    process.stdout.write(`  ${label}: ${Math.min(i + CHUNK, statements.length)}/${statements.length}\r`);
  }
  process.stdout.write(`  ${label}: ${statements.length}/${statements.length} done\n`);
}

async function idMap(client: ReturnType<typeof createD1HttpClient>, sql: string): Promise<Map<string, number>> {
  const res = await client.prepare(sql).bind().all<{ id: number; key: string }>();
  return new Map(res.results.map((r) => [r.key, r.id]));
}

async function main(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.D1_DATABASE_ID;
  if (!accountId || !databaseId) {
    throw new Error("Missing CLOUDFLARE_ACCOUNT_ID or D1_DATABASE_ID. Fill in .env.local first.");
  }
  const authMode = process.env.D1_AUTH_MODE === "api-token" ? "api-token" : "wrangler-oauth";
  const client = createD1HttpClient({ accountId, databaseId, authMode });

  console.log("Seeding Vovingo content into D1...\n");

  // 1) Content-only tables with child rows: clear children first (answers cascade).
  await client.exec(
    [
      "DELETE FROM podcast_transcripts",
      "DELETE FROM listening_questions",
      "DELETE FROM exercises WHERE lesson_id IS NULL",
      "DELETE FROM exercises WHERE lesson_id IN (SELECT id FROM lessons WHERE slug IN (" +
        lessons.map((l) => q(l.slug)).join(", ") +
        "))",
    ].join(";\n")
  );
  console.log("  cleared podcast transcripts, listening questions and content exercises");

  // 2) Courses
  await runChunks(
    client,
    courses.map((c) =>
      upsert(
        "courses",
        {
          slug: c.slug,
          title: c.title,
          description: c.description,
          level: c.level,
          category: c.category,
          icon: c.icon,
          order_index: c.orderIndex,
          published: 1,
          created_at: now(),
        },
        ["slug"]
      )
    ),
    "courses"
  );
  const courseIds = await idMap(client, "SELECT id, slug AS key FROM courses");

  // 3) Lessons
  await runChunks(
    client,
    lessons.map((l) =>
      upsert(
        "lessons",
        {
          slug: l.slug,
          course_id: courseIds.get(l.courseSlug) ?? null,
          module_id: null,
          title: l.title,
          category: l.category,
          level: l.level,
          summary: l.summary,
          duration_min: l.durationMin,
          order_index: l.orderIndex,
          skill_focus: l.skillFocus,
          content: l.content,
          published: 1,
          created_at: now(),
          updated_at: now(),
        },
        ["slug"]
      )
    ),
    "lessons"
  );
  const lessonIds = await idMap(client, "SELECT id, slug AS key FROM lessons");

  // 4) Exercises (children deleted above)
  await runChunks(
    client,
    exercises.map((e) =>
      insert("exercises", {
        lesson_id: lessonIds.get(e.lessonSlug) ?? null,
        type: e.type,
        skill: e.skill,
        prompt: e.prompt,
        options: e.options ?? null,
        // JSON-mode column: scalar strings must be JSON-encoded ("..."), not bare text.
        correct_answer: e.correctAnswer == null ? null : JSON.stringify(e.correctAnswer),
        explanation: e.explanation,
        difficulty: normDifficulty(e.difficulty),
        tags: e.tags,
        order_index: e.orderIndex,
        created_at: now(),
      })
    ),
    "exercises"
  );

  // 5) Vocabulary
  await runChunks(
    client,
    vocabulary.map((v) =>
      upsert(
        "vocabulary",
        {
          word: v.word,
          definition: v.definition,
          pronunciation: v.pronunciation,
          example: v.example,
          synonyms: v.synonyms,
          antonyms: v.antonyms,
          collocations: v.collocations,
          category: v.category,
          topic: v.topic,
          difficulty: normDifficulty(v.difficulty),
          native_gloss: v.nativeGloss ?? null,
          created_at: now(),
        },
        ["word", "category"]
      )
    ),
    "vocabulary"
  );
  const vocabRes = await client
    .prepare("SELECT id, word, category FROM vocabulary")
    .bind()
    .all<{ id: number; word: string; category: string }>();
  const vocabIdByWord = new Map<string, number>();
  for (const r of vocabRes.results) if (!vocabIdByWord.has(r.word)) vocabIdByWord.set(r.word, r.id);

  // 6) Podcasts + transcripts + questions
  await runChunks(
    client,
    podcasts.map((p) =>
      upsert(
        "podcasts",
        {
          slug: p.slug,
          title: p.title,
          topic: p.topic,
          description: p.description,
          level: p.level,
          duration_sec: p.durationSec,
          audio_url: null,
          cover_emoji: p.coverEmoji,
          published_date: p.publishedDate,
          featured: p.featured ? 1 : 0,
          vocabulary_ids: p.vocabularyWords.map((w) => vocabIdByWord.get(w)).filter((n): n is number => n != null),
          published: 1,
          created_at: now(),
        },
        ["slug"]
      )
    ),
    "podcasts"
  );
  const podcastIds = await idMap(client, "SELECT id, slug AS key FROM podcasts");

  const podcastRows: string[] = [];
  for (const p of podcasts) {
    const podcastId = podcastIds.get(p.slug);
    if (podcastId == null) continue;
    podcastRows.push(`DELETE FROM podcast_transcripts WHERE podcast_id = ${podcastId}`);
    podcastRows.push(`DELETE FROM listening_questions WHERE podcast_id = ${podcastId}`);
    for (const t of p.transcript) {
      podcastRows.push(
        insert("podcast_transcripts", {
          podcast_id: podcastId,
          order_index: t.orderIndex,
          start_ms: t.startMs,
          end_ms: t.endMs,
          text: t.text,
        })
      );
    }
    for (const qn of p.questions) {
      podcastRows.push(
        insert("listening_questions", {
          podcast_id: podcastId,
          type: qn.type,
          prompt: qn.prompt,
          options: qn.options,
          correct_index: qn.correctIndex,
          explanation: qn.explanation,
          order_index: qn.orderIndex,
        })
      );
    }
  }
  await runChunks(client, podcastRows, "transcripts/questions");

  // 7) Scenarios
  await runChunks(
    client,
    scenarios.map((s) =>
      upsert(
        "scenarios",
        {
          slug: s.slug,
          title: s.title,
          category: s.category,
          description: s.description,
          difficulty: normDifficulty(s.difficulty),
          persona: s.persona ?? null,
          opening_prompt: s.openingPrompt ?? null,
          tags: s.tags,
          skill_focus: s.skillFocus ?? null,
          created_at: now(),
        },
        ["slug"]
      )
    ),
    "scenarios"
  );

  // 8) Mistakes (linked to lessons)
  await runChunks(
    client,
    mistakes.map((m) =>
      upsert(
        "mistakes",
        {
          key: m.key,
          title: m.title,
          category: m.category,
          subcategory: m.subcategory ?? null,
          description: m.description,
          wrong_example: m.wrongExample,
          correct_example: m.correctExample,
          why: m.why,
          natural_alternative: m.naturalAlternative ?? null,
          severity: m.severity,
          lesson_id: m.lessonSlug ? lessonIds.get(m.lessonSlug) ?? null : null,
          practice_prompts: m.practicePrompts,
          detection: m.detection,
          created_at: now(),
        },
        ["key"]
      )
    ),
    "mistakes"
  );

  // 9) Achievements
  await runChunks(
    client,
    achievements.map((a) =>
      upsert(
        "achievements",
        { key: a.key, title: a.title, description: a.description, icon: a.icon, xp: a.xp, criteria: a.criteria },
        ["key"]
      )
    ),
    "achievements"
  );

  // Verification
  const tables = [
    "courses",
    "lessons",
    "exercises",
    "vocabulary",
    "podcasts",
    "podcast_transcripts",
    "listening_questions",
    "scenarios",
    "mistakes",
    "achievements",
  ];
  const counts = await client.prepare(`SELECT ${tables.map((t) => `(SELECT count(*) FROM ${t}) AS ${t}`).join(", ")}`).bind().all<Record<string, number>>();
  console.log("\nRow counts:");
  console.log(counts.results[0]);

  const linkCheck = await client
    .prepare(
      [
        "SELECT",
        "(SELECT count(*) FROM lessons WHERE course_id IS NULL) AS lessons_without_course,",
        "(SELECT count(*) FROM mistakes WHERE lesson_id IS NULL) AS mistakes_without_lesson,",
        "(SELECT count(*) FROM exercises WHERE lesson_id IS NULL) AS exercises_without_lesson,",
        "(SELECT count(*) FROM podcasts WHERE json_array_length(coalesce(vocabulary_ids, '[]')) = 0) AS podcasts_without_vocab"
      ].join(" ")
    )
    .bind()
    .all<Record<string, number>>();
  console.log("Link check:", linkCheck.results[0]);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
