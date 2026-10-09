import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Privacy notice" };

/** Story 7: what NoorAI Tracks stores, why, who sees it, and how to get it deleted. Public page. */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="mb-8 inline-block"><Logo size={36} product="Tracks" /></Link>
      <h1 className="h1 mb-2">Privacy notice</h1>
      <p className="mb-8 text-ink-muted">NoorAI Tracks helps schools follow each student&apos;s progress through a learning roadmap. This page says, in plain words, what we keep about you and why.</p>

      <div className="space-y-6 text-[0.95rem] leading-relaxed">
        <section>
          <h2 className="h2 mb-2">What we keep</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li><b>Your account:</b> name, email, and your password in a scrambled form that no one can read back. If you sign in with Google, we keep only your name, email and picture from Google.</li>
            <li><b>Your school:</b> which school and class (cohort) you are in, and your role (student, teacher or admin).</li>
            <li><b>Your learning:</b> lessons you tick, links and notes you add as evidence, your weekly log (hours, what you finished, where you are stuck), attendance, and your teachers&apos; reviews, sign-offs and assessment scores.</li>
            <li><b>An activity log</b> of important changes (for example who verified work or changed a role), so the school can see what happened and when.</li>
            <li><b>Sign-in attempts</b> with a wrong password, kept for one day, only to stop password guessing.</li>
          </ul>
          <p className="mt-2">We don&apos;t sell your data, show you adverts, or use it to train AI models.</p>
        </section>

        <section>
          <h2 className="h2 mb-2">Who can see it</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You see your own progress.</li>
            <li>Your teachers see the progress of the classes they teach. Your school&apos;s admins see everyone in your school.</li>
            <li>Other schools never see your data.</li>
            <li>NoorAI&apos;s platform team can see it only to run the service and help your school.</li>
          </ul>
        </section>

        <section>
          <h2 className="h2 mb-2">Where it is kept</h2>
          <p>The app runs on Vercel and the database on Neon, in their Singapore region. Connections are encrypted.</p>
        </section>

        <section>
          <h2 className="h2 mb-2">How long, and your choices</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>We keep your data while you are part of a school on NoorAI Tracks.</li>
            <li>To see, download, correct or delete your data, ask your school&apos;s admin. An admin can delete a person&apos;s data permanently.</li>
            <li>If you are under 18, your parent or guardian should agree to this notice with you.</li>
          </ul>
        </section>
      </div>
      <p className="mt-10 text-sm text-ink-muted"><Link href="/login" className="text-secondary underline">Back to NoorAI Tracks</Link></p>
    </main>
  );
}
