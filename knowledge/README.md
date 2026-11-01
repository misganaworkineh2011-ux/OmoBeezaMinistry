# Chatbot knowledge base

The website's chat assistant answers questions **only** from the documents in this folder.

- Supported: `.pdf`, `.docx`, `.md`, `.txt` (English or Amharic).
- Add, replace or remove files, then run `npm run dev` or `npm run build`
  (or `npm run knowledge`) — the knowledge base is rebuilt automatically.
- Files whose names start with `_`, and this README, are ignored.
- Scanned PDFs (pictures of pages) contain no text and can't be read — use the
  original Word/PDF file, or paste the text into a `.txt` file.
- Use clear file names (e.g. `annual-report-2025.pdf`): the name is shown to
  visitors as the source of an answer.

`omo-beeza-website.md` is a starter document with the facts already published on
the website. Keep it, edit it, or delete it once your own documents cover the same
ground.

Do not put private information here (bank logins, staff phone numbers that are not
public, children's medical details, etc.): anything in these documents can be
quoted to any visitor.
