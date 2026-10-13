// WhatsApp buttons: a wa.me link opens WhatsApp (app on a phone, WhatsApp Web or Desktop on a computer)
// with the message already typed. The person picks the chat and presses Send; nothing is sent by the
// app and no phone numbers are stored. Pure and tested in whatsapp.test.ts.

export function whatsappUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const ROLE_WORDS: Record<string, string> = { STUDENT: "a student", INSTRUCTOR: "a teacher", ADMIN: "an admin" };

export function inviteMessage(i: { school: string; role: string; cohort?: string | null; link: string; until?: string | null }) {
  const where = i.cohort ? ` in ${i.cohort}` : "";
  const until = i.until ? ` (valid until ${i.until})` : "";
  return `Assalam-o-Alaikum! Join ${i.school} on NoorAI Tracks as ${ROLE_WORDS[i.role] ?? "a member"}${where}. Open this link and create your account: ${i.link}${until}`;
}

export function resetMessage(link: string) {
  return `Your NoorAI Tracks password reset link. It works once, for 1 hour: ${link}`;
}

export function welcomeMessage(w: { name: string; cohort: string; link: string; days: number }) {
  return `Assalam-o-Alaikum ${w.name}! Welcome to ${w.cohort}. Set your NoorAI Tracks password here to start: ${w.link} (valid for ${w.days} days)`;
}

export function certificateMessage(c: { name: string; course: string; school: string; link: string }) {
  return `${c.name} completed ${c.course} at ${c.school}. Check it is genuine: ${c.link}`;
}

/** The day's attendance for a parents' group or the principal: who was absent, late or on leave. */
export function absentListMessage(a: { cohort: string; day: string; present: number; total: number; absent: string[]; late: string[]; leave: string[] }) {
  const line = (label: string, names: string[]) => (names.length ? `
${label} (${names.length}): ${names.join(", ")}` : "");
  const head = `Attendance, ${a.cohort}, ${a.day}: ${a.present} of ${a.total} present.`;
  const rest = line("Absent", a.absent) + line("Late", a.late) + line("On leave", a.leave);
  return rest ? head + rest : `${head} Everyone was present.`;
}
