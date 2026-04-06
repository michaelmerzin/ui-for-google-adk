import { useState } from "react";
import styles from "./ResponseRenderer.module.css";

// ── Types ─────────────────────────────────────────────────────────────────────

type Block =
  | { type: "text";   content: string }
  | { type: "code";   lang: string; content: string }
  | { type: "table";  headers: string[]; rows: string[][] }
  | { type: "map";    locations: Location[] }
  | { type: "json";   content: string }
  | { type: "list";   ordered: boolean; items: string[] };

interface Location {
  name: string;
  lat: number;
  lng: number;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ResponseRenderer({ content }: { content: string }) {
  const blocks = parseBlocks(content);
  return (
    <div className={styles.root}>
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} />
      ))}
    </div>
  );
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "text":   return <TextBlock content={block.content} />;
    case "code":   return <CodeBlock lang={block.lang} content={block.content} />;
    case "table":  return <TableBlock headers={block.headers} rows={block.rows} />;
    case "map":    return <MapBlock locations={block.locations} />;
    case "json":   return <JsonBlock content={block.content} />;
    case "list":   return <ListBlock ordered={block.ordered} items={block.items} />;
    default:       return null;
  }
}

// ── Text block ────────────────────────────────────────────────────────────────

function TextBlock({ content }: { content: string }) {
  if (!content.trim()) return null;
  return (
    <p
      className={styles.text}
      dangerouslySetInnerHTML={{ __html: renderInline(content) }}
    />
  );
}

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({ lang, content }: { lang: string; content: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className={styles.codeBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>{lang || "code"}</span>
        <button className={styles.copyBtn} onClick={copy}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className={styles.pre}><code>{content}</code></pre>
    </div>
  );
}

// ── Table block ───────────────────────────────────────────────────────────────

function TableBlock({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            {headers.map((h, i) => <th key={i}>{h.trim()}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => <td key={j}>{cell.trim()}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Map block (OpenStreetMap iframe, no API key needed) ───────────────────────

function MapBlock({ locations }: { locations: Location[] }) {
  const [selected, setSelected] = useState<Location | null>(null);

  // Build an OpenStreetMap embed URL
  // For multiple points: center on the average, show markers via query
  const center = locations.length === 1
    ? locations[0]
    : {
        lat: locations.reduce((s, l) => s + l.lat, 0) / locations.length,
        lng: locations.reduce((s, l) => s + l.lng, 0) / locations.length,
      };

  const zoom = locations.length === 1 ? 14 : 6;

  // Build marker query string for uMap or use simple OSM embed
  const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${
    center.lng - 0.05
  }%2C${center.lat - 0.05}%2C${center.lng + 0.05}%2C${center.lat + 0.05}&layer=mapnik&marker=${center.lat}%2C${center.lng}`;

  return (
    <div className={styles.mapBlock}>
      <div className={styles.mapHeader}>
        <span className={styles.mapTitle}>📍 {locations.length} location{locations.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Location list */}
      <div className={styles.locationList}>
        {locations.map((loc, i) => (
          <button
            key={i}
            className={`${styles.locationItem} ${selected?.name === loc.name ? styles.locationSelected : ""}`}
            onClick={() => setSelected(selected?.name === loc.name ? null : loc)}
          >
            <span className={styles.locationPin}>📍</span>
            <span className={styles.locationName}>{loc.name}</span>
            <span className={styles.locationCoords}>{loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}</span>
          </button>
        ))}
      </div>

      {/* Map iframe */}
      <iframe
        className={styles.mapIframe}
        src={selected
          ? `https://www.openstreetmap.org/export/embed.html?bbox=${selected.lng - 0.05}%2C${selected.lat - 0.05}%2C${selected.lng + 0.05}%2C${selected.lat + 0.05}&layer=mapnik&marker=${selected.lat}%2C${selected.lng}`
          : osmUrl
        }
        title="Map"
        loading="lazy"
      />

      <a
        className={styles.mapLink}
        href={`https://www.openstreetmap.org/?mlat=${(selected ?? locations[0]).lat}&mlon=${(selected ?? locations[0]).lng}#map=${zoom}/${(selected ?? locations[0]).lat}/${(selected ?? locations[0]).lng}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open in OpenStreetMap ↗
      </a>
    </div>
  );
}

// ── JSON block ────────────────────────────────────────────────────────────────

function JsonBlock({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(true);
  let parsed: unknown;
  try { parsed = JSON.parse(content); } catch { return <CodeBlock lang="json" content={content} />; }

  return (
    <div className={styles.jsonBlock}>
      <div className={styles.codeHeader}>
        <span className={styles.codeLang}>json</span>
        <button className={styles.copyBtn} onClick={() => setExpanded(e => !e)}>
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

// ── List block ────────────────────────────────────────────────────────────────

function ListBlock({ ordered, items }: { ordered: boolean; items: string[] }) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={styles.list}>
      {items.map((item, i) => (
        <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
      ))}
    </Tag>
  );
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseBlocks(raw: string): Block[] {
  const blocks: Block[] = [];
  const lines = raw.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim().toLowerCase();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const codeContent = codeLines.join("\n");

      // Try to detect JSON
      if (lang === "json" || isJson(codeContent)) {
        blocks.push({ type: "json", content: codeContent });
      } else {
        blocks.push({ type: "code", lang, content: codeContent });
      }
      continue;
    }

    // ── Markdown table ──
    if (line.includes("|") && i + 1 < lines.length && lines[i + 1].match(/^\|[\s\-|]+\|$/)) {
      const headers = line.split("|").filter(Boolean).map(h => h.trim());
      i += 2; // skip header and separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i].split("|").filter(Boolean).map(c => c.trim());
        rows.push(row);
        i++;
      }
      // Check if any cell looks like coordinates
      const locations = extractLocationsFromTable(headers, rows);
      if (locations.length > 0) {
        blocks.push({ type: "map", locations });
      } else {
        blocks.push({ type: "table", headers, rows });
      }
      continue;
    }

    // ── Unordered list ──
    if (line.match(/^[\-\*\+] /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[\-\*\+] /)) {
        items.push(lines[i].replace(/^[\-\*\+] /, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // ── Ordered list ──
    if (line.match(/^\d+\. /)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // ── Inline coordinate detection in text ──
    const coords = extractCoordinatesFromText(line);
    if (coords.length > 0) {
      // Collect all consecutive coordinate-like lines
      const locations: Location[] = [...coords];
      i++;
      while (i < lines.length) {
        const moreCoords = extractCoordinatesFromText(lines[i]);
        if (moreCoords.length > 0) { locations.push(...moreCoords); i++; }
        else break;
      }
      blocks.push({ type: "map", locations });
      continue;
    }

    // ── Plain text ──
    const textLines: string[] = [];
    while (
      i < lines.length &&
      !lines[i].startsWith("```") &&
      !lines[i].includes("|") &&
      !lines[i].match(/^[\-\*\+] /) &&
      !lines[i].match(/^\d+\. /) &&
      extractCoordinatesFromText(lines[i]).length === 0
    ) {
      textLines.push(lines[i]);
      i++;
    }
    if (textLines.join("").trim()) {
      blocks.push({ type: "text", content: textLines.join("\n") });
    }
  }

  return blocks;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isJson(str: string): boolean {
  try { JSON.parse(str); return str.trim().startsWith("{") || str.trim().startsWith("["); }
  catch { return false; }
}

// Detect coordinates like: "Paris: 48.8566, 2.3522" or "(48.8566, 2.3522)"
function extractCoordinatesFromText(line: string): Location[] {
  const results: Location[] = [];
  // Pattern: name: lat, lng  OR  lat, lng  OR  (lat, lng)
  const pattern = /([A-Za-z\s]+)?:?\s*\(?(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\)?/g;
  let match;
  while ((match = pattern.exec(line)) !== null) {
    const lat = parseFloat(match[2]);
    const lng = parseFloat(match[3]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      results.push({
        name: match[1]?.trim() || `${lat}, ${lng}`,
        lat,
        lng,
      });
    }
  }
  return results;
}

// Check if a table with lat/lng columns should be a map
function extractLocationsFromTable(headers: string[], rows: string[][]): Location[] {
  const lowerHeaders = headers.map(h => h.toLowerCase());
  const latIdx = lowerHeaders.findIndex(h => h.includes("lat"));
  const lngIdx = lowerHeaders.findIndex(h => h.includes("lon") || h.includes("lng"));
  const nameIdx = lowerHeaders.findIndex(h => h.includes("name") || h.includes("city") || h.includes("location") || h.includes("place"));

  if (latIdx === -1 || lngIdx === -1) return [];

  return rows.flatMap(row => {
    const lat = parseFloat(row[latIdx]);
    const lng = parseFloat(row[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) return [];
    return [{
      name: nameIdx !== -1 ? row[nameIdx] : `${lat}, ${lng}`,
      lat,
      lng,
    }];
  });
}

// Inline markdown: bold, italic, inline code, links
function renderInline(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='icode'>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
