/**
 * Strips Markdown syntax down to plain, speakable text for TTS. The chat
 * agents' system prompts instruct bold entity names and Markdown lists
 * (lib/server/services/ai-service/grid-agent/prompts.ts §"Formatting your
 * answers") — `ReactMarkdown` renders that for the chat bubble, but raw
 * markup sent to `tts-1` is dropped/garbled rather than spoken.
 * docs/features/17-voice-chat-loop.md §6
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // Headings: drop the leading '#'s, keep the text.
      .replace(/^#{1,6}\s+/gm, '')
      // Bold/italic: **text**, __text__, *text*, _text_ → text.
      .replace(/(\*\*\*|___)(.+?)\1/g, '$2')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/(\*|_)(.+?)\1/g, '$2')
      // Inline code: `text` → text.
      .replace(/`([^`]+)`/g, '$1')
      // List markers: '- ', '* ', '1. ' at the start of a line → removed,
      // so items read as separate spoken sentences rather than running
      // together (list markers are replaced, not the item text).
      .replace(/^\s*[-*]\s+/gm, '')
      .replace(/^\s*\d+\.\s+/gm, '')
      // Collapse the newlines list-splitting leaves behind into ". " so
      // TTS treats each former list item as its own sentence — but only
      // when there actually were multiple lines to join; a single-line
      // answer must pass through without gaining a period it never had.
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, i, lines) => (lines.length === 1 || /[.!?:]$/.test(line) ? line : `${line}.`))
      .join(' ')
      .trim()
  );
}
