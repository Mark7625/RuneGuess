import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import npcMappingsJson from "@/data/npcs_mappings.json";
import itemMappingsJson from "@/data/item_mappings.json";
import objectMappingsJson from "@/data/object_mappings.json";

type ExamineCategory = "items" | "npcs" | "objects";

type MappingEntry = {
  name: string;
};

type ExamineEntry = {
  id: number;
  category: ExamineCategory;
  name: string;
  examine: string;
};

const npcMappings = npcMappingsJson as Record<string, MappingEntry>;
const itemMappings = itemMappingsJson as Record<string, MappingEntry>;
const objectMappings = objectMappingsJson as Record<string, MappingEntry>;

function readCsvLines(relativePath: string): string[] {
  const fullPath = path.join(process.cwd(), "src", "data", relativePath);
  const raw = fs.readFileSync(fullPath, "utf8");
  return raw.split(/\r?\n/);
}

function parseExamineCsv(
  relativePath: string,
  category: ExamineCategory,
  lookup: Record<string, MappingEntry>
): ExamineEntry[] {
  const lines = readCsvLines(relativePath);
  const entries: ExamineEntry[] = [];

  for (const line of lines) {
    if (!line) continue;
    const [idPart, ...rest] = line.split(",");
    const idStr = idPart.trim();
    if (!idStr || idStr === "id") continue;
    const id = Number(idStr);
    if (Number.isNaN(id)) continue;

    const mapping = lookup[idStr];
    if (!mapping || !mapping.name || mapping.name === "null") continue;

    const examineRaw = rest.join(",").trim();
    if (!examineRaw) continue;

    const examine = examineRaw.replace(/^"|"$/g, "");

    entries.push({
      id,
      category,
      name: mapping.name,
      examine
    });
  }

  return entries;
}

let cachedPool: ExamineEntry[] | null = null;

function buildPool(): ExamineEntry[] {
  if (cachedPool) return cachedPool;

  const npcEntries = parseExamineCsv("npcs_exmaines.csv", "npcs", npcMappings);
  const itemEntries = parseExamineCsv("item_exmaines.csv", "items", itemMappings);
  const objectEntries = parseExamineCsv(
    "object_exmaines.csv",
    "objects",
    objectMappings
  );

  cachedPool = [...npcEntries, ...itemEntries, ...objectEntries];
  return cachedPool;
}

export function GET() {
  const pool = buildPool();
  return NextResponse.json({ pool });
}

