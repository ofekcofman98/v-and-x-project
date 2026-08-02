/** Derives a TableColumn.key slug from a column label. Must match the server's insertion logic exactly. */
export function toColumnKey(label: string): string {
  return label.toLowerCase().replace(/\s+/g, '_');
}
