/**
 * Script to update HTML report templates in all security scripts
 * Run with: npx tsx scripts/update-html-templates.ts
 */

import { db } from "../server/db";
import { scripts } from "../shared/schema";
import { eq, sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load templates
const powershellTemplate = fs.readFileSync(
  path.join(__dirname, "powershell-html-template.ps1"),
  "utf-8"
);

const bashTemplate = fs.readFileSync(
  path.join(__dirname, "bash-html-template.sh"),
  "utf-8"
);

async function updateHtmlTemplates() {
  console.log("Starting HTML template update...");

  // Get all scripts with content
  const allScripts = await db
    .select()
    .from(scripts)
    .where(sql`content IS NOT NULL AND LENGTH(content) > 100`);

  let updatedCount = 0;

  for (const script of allScripts) {
    if (!script.content || script.content.length < 100) {
      console.log(`Skipping ${script.name} - no content`);
      continue;
    }

    let content = script.content;
    let updated = false;

    // PowerShell scripts
    if (script.filename?.endsWith(".ps1")) {
      const funcPattern = /function\s+Generate-HtmlReport\s*\{[\s\S]*?\n\}/;

      if (funcPattern.test(content)) {
        // Find and replace the function
        const newContent = content.replace(funcPattern, powershellTemplate);

        if (newContent !== content) {
          await db
            .update(scripts)
            .set({ content: newContent })
            .where(eq(scripts.id, script.id));

          console.log(`Updated PowerShell script: ${script.name}`);
          updatedCount++;
          updated = true;
        }
      } else {
        console.log(
          `PowerShell script ${script.name} - Generate-HtmlReport not found`
        );
      }
    }

    // Bash scripts
    if (script.filename?.endsWith(".sh")) {
      const funcPattern = /generate_html_report\s*\(\s*\)\s*\{[\s\S]*?\n\}/;

      if (funcPattern.test(content)) {
        const newContent = content.replace(funcPattern, bashTemplate);

        if (newContent !== content) {
          await db
            .update(scripts)
            .set({ content: newContent })
            .where(eq(scripts.id, script.id));

          console.log(`Updated Bash script: ${script.name}`);
          updatedCount++;
          updated = true;
        }
      } else {
        console.log(
          `Bash script ${script.name} - generate_html_report not found`
        );
      }
    }
  }

  console.log(`\nCompleted! Updated ${updatedCount} scripts.`);
  process.exit(0);
}

updateHtmlTemplates().catch((err) => {
  console.error("Error updating templates:", err);
  process.exit(1);
});
