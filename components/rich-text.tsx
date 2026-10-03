/**
 * Renderiza el formato simple de las descripciones: párrafos separados por
 * línea en blanco, "## " para subtítulos y "- " para listas. Solo texto: nunca HTML.
 */
type Block = { type: "heading" | "paragraph"; text: string } | { type: "list"; items: string[] };

function parse(source: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of source.trim().split(/\n{2,}/)) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    let paragraph: string[] = [];
    const flush = () => { if (paragraph.length) blocks.push({ type: "paragraph", text: paragraph.join(" ") }); paragraph = []; };
    for (const line of lines) {
      if (line.startsWith("## ")) { flush(); blocks.push({ type: "heading", text: line.slice(3) }); }
      else if (line.startsWith("- ")) {
        flush();
        const last = blocks.at(-1);
        if (last?.type === "list") last.items.push(line.slice(2));
        else blocks.push({ type: "list", items: [line.slice(2)] });
      } else paragraph.push(line);
    }
    flush();
  }
  return blocks;
}

export function RichText({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`rich-text ${className}`}>
      {parse(source).map((block, index) => block.type === "heading" ? <h3 key={index}>{block.text}</h3>
        : block.type === "list" ? <ul key={index}>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>
        : <p key={index}>{block.text}</p>)}
    </div>
  );
}
