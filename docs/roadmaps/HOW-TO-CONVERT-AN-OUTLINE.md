# How to turn a teacher's outline into a roadmap

A teacher sends a course outline as a PDF or Word file. Tracks only uploads roadmap files (`.json`).
This guide turns the outline into that file with your Claude chat. It costs nothing extra and takes about 5 minutes.

You need:
- the teacher's outline (PDF or Word)
- the example file `web-designing-foundation.json` (in this folder)
- a Tracks admin login

---

## Step 1: Open a new chat

1. Go to **claude.ai** and start a **new chat**.
2. Attach **two files**:
   - the teacher's outline (PDF or Word)
   - `web-designing-foundation.json` from this folder (the example)

## Step 2: Paste this instruction

Copy everything in the box below and paste it into the chat, then press **Enter**.

```text
Turn the attached course outline into a NoorAI Tracks roadmap file.
Use the attached web-designing-foundation.json as the exact format to copy.

The format:
- One JSON object per programme: title, kind "COURSE", edition (the year), subtitle
  (for example "3 months · 12 weeks · Foundation / Beginner"), summary (1–2 sentences),
  expert (one sentence: what a student can do at the end), benchmarks (the learning
  outcomes as {title, detail}), and stages.
- Each stage: key, title, level, weeks (a whole number), goal (one sentence),
  doneWhen (one sentence a teacher can check), items.
- Each item: key, title, detail (one short line), kind, group.
  - kind is LESSON for a topic, PROJECT for something the student builds,
    DELIVERABLE for something the student hands in (assignment, report, portfolio),
    MILESTONE for the final project.
  - group is the week, written like "Week 3 · Typography & colour" (80 characters at most).
- key: lowercase letters, numbers and dashes only, made from the title.
  Every stage key is different, and every item key inside a stage is different.
- Titles: 200 characters at most.

Rules:
- Use the outline's own topics and wording. Do not invent topics.
- If the outline has more than one programme with its own certificate
  (for example a 3-month and a 6-month course), make one separate file for each.
- If the outline lists the same topics twice (for example under "Modules" and again under
  "Topics covered"), use them once.
- Split the course into stages of about 3–4 weeks, and spread the topics over the weeks
  in a sensible teaching order. The stage weeks must add up to the course length.
- Add one practical item (PROJECT or DELIVERABLE) at the end of each stage, and the
  final project as a MILESTONE in the last stage. Base them on what the outline says
  (assignments, projects, portfolio).
- Leave out instructor names, testimonials, fees and admission information.

Give me each finished roadmap as a downloadable .json file, named after the course
(for example digital-marketing-foundation.json). Then list in plain words anything
you had to guess, such as the week numbers.
```

## Step 3: Download and check

1. Download the `.json` file(s) Claude gives you.
2. Read the list of things Claude guessed. You can fix those after uploading.

## Step 4: Upload to Tracks

1. Sign in to Tracks as an **admin**.
2. Go to **Tracks → New roadmap**.
3. Under **Roadmap file (.json)**, click **Choose file**, pick the file, then click **Upload**.
4. The roadmap opens as a **draft**. Check the stages and weeks, and change anything you like.
5. Click **Publish**. Teachers can now make cohorts with it.

---

## If the upload shows an error

Tracks checks every file and says exactly what is wrong, for example:

> Stage 3, item 5: has a key that is not lowercase letters, numbers and dashes

Copy the error message into the **same Claude chat** and write:

```text
Tracks says this about the file. Please fix it and give me the corrected .json file.
```

Then upload the corrected file.

## Good to know

- The teacher's outline is only sent to your Claude chat, never any student data.
- You can always change a roadmap later in the editor; students' progress is kept.
- A scanned PDF (a photo of paper) still works in Claude chat, because Claude can read images.
