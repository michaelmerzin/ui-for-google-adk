import { useState } from "react";
import MapView, { type Location } from "./MapView";
import styles from "./ResponseRenderer.module.css";

type Block =
  | { type: "text"; content: string }
  | { type: "code"; lang: string; content: string }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "map_table"; locations: Location[]; headers: string[]; rows: string[][] }
  | { type: "json"; content: string }
  | { type: "list"; ordered: boolean; items: string[] };

export default function ResponseRenderer({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className={styles.root}>
      {blocks.map((block, index) => (
        <BlockRenderer key={index} block={block} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return <TextBlock content={block.content} />;
    case "code":
      return <CodeBlock lang={block.lang} content={block.content} />;
    case "table":
      return <TableBlock headers={block.headers} rows={block.rows} />;
    case "map_table":
      return <MapTableBlock locations={block.locations} headers={block.headers} rows={block.rows} />;
    case "json":
      return <JsonBlock content={block.content} />;
    case "list":
      return <ListBlock ordered={block.ordered} items={block.items} />;
    default:
      return null;
  }
}

function TextBlock({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <p
      className={styles.text}
      dangerouslySetInnerHTML={{ __html: renderInline(content) }}
    />
  );
}

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang || "code"}</span>
        <button className={styles.copyBtn} onClick={() => void copy()}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.pre}><code>{content}</code></pre>
    </div>
  );
}

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((header, index) => <th key={index}>{header.trim()}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => <td key={cellIndex}>{cell.trim()}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MapTableBlock({
  locations,
  headers,
  rows,
}: {
  locations: Location[];
  headers: string[];
  rows: string[][];
}) {
  const [view, setView] = useState<"map" | "table">("map");

  return (
    <div className={styles.mapBlock}>
      <div className={styles.mapHeader}>
        <span className={styles.mapTitle}>
          {locations.length} location{locations.length !== 1 ? "s" : ""}
        </span>

        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${view === "map" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("map")}
          >
            Map
          </button>
          <button
            className={`${styles.viewBtn} ${view === "table" ? styles.viewBtnActive : ""}`}
            onClick={() => setView("table")}
          >
            Table
          </button>
        </div>
      </div>

      {view === "map" ? (
        <MapView locations={locations} />
      ) : (
        <TableBlock headers={headers} rows={rows} />
      )}

    </div>
  );
}

function JsonBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(true);
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return <CodeBlock lang="json" content={content} />;
  }

  return (
    <div className={styles.jsonBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>json</span>
        <button className={styles.copyBtn} onClick={() => setExpanded((open) => !open)}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      {expanded && (
        <pre className={styles.pre}>
          <code>{JSON.stringify(parsed, null, 2)}</code>
        </pre>
      )}
    </div>
  );
}

function ListBlock({ ordered, items }: { ordered: boolean; items: string[] }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={styles.list}>
      {items.map((item, index) => (
        <li key={index} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
      ))}
    </Tag>
  );
}

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  const lines = raw.split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      index++;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index++;
      }
      index++;
      const codeContent = codeLines.join("\n");
      if (lang === "json" || isJson(codeContent)) {
        blocks.push({ type: "json", content: codeContent });
      } else {
        blocks.push({ type: "code", lang, content: codeContent });
      }
      continue;
    }

    if (line.includes("|") && index + 1 < lines.length && lines[index + 1].match(/^\|[\s\-|]+\|$/)) {
      const headers = line.split("|").filter(Boolean).map((h) => h.trim());
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && lines[index].includes("|")) {
        rows.push(lines[index].split("|").filter(Boolean).map((c) => c.trim()));
        index++;
      }
      const locations = extractLocationsFromTable(headers, rows);
      if (locations.length > 0) {
        blocks.push({ type: "map_table", locations, headers, rows });
      } else {
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    if (line.match(/^[\-\*\+] /)) {
      const items: string[] = [];
      while (index < lines.length && lines[index].match(/^[\-\*\+] /)) {
        items.push(lines[index].replace(/^[\-\*\+] /, ""));
        index++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (index < lines.length && lines[index].match(/^\d+\. /)) {
        items.push(lines[index].replace(/^\d+\. /, ""));
        index++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    const textLines: string[] = [];
    while (
      index < lines.length &&
      !lines[index].startsWith("```") &&
      !lines[index].includes("|") &&
      !lines[index].match(/^[\-\*\+] /) &&
      !lines[index].match(/^\d+\. /)
    ) {
      textLines.push(lines[index]);
      index++;
    }

    if (textLines.join("").trim()) {
      blocks.push({ type: "text", content: textLines.join("\n") });
    }
  }

  return blocks;
}

function isJson(str: string): boolean {
  try {
    JSON.parse(str);
    return str.trim().startsWith("{") || str.trim().startsWith("[");
  } catch {
    return false;
  }
}


function extractLocationsFromTable(headers: string[], rows: string[][]): Location[] {
  const lowerHeaders = headers.map((h) => h.toLowerCase());
  const latIndex = lowerHeaders.findIndex((h) => h.includes("lat"));
  const lngIndex = lowerHeaders.findIndex((h) => h.includes("lon") || h.includes("lng"));
  const nameIndex = lowerHeaders.findIndex(
    (h) => h.includes("name") || h.includes("city") || h.includes("location") || h.includes("place")
  );

  if (latIndex === -1 || lngIndex === -1) return [];

  return rows.flatMap((row) => {
    const lat = parseFloat(row[latIndex]);
    const lng = parseFloat(row[lngIndex]);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return [];
    return [{ name: nameIndex !== -1 ? row[nameIndex] : `${lat}, ${lng}`, lat, lng }];
  });
}

function renderInline(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='icode'>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
