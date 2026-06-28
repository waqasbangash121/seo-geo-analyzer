import { useState } from "react";
import { SchemaAuditResult } from "@/lib/reportTypes";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Copy, Code2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const priorityStyles: Record<string, string> = {
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
};

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("JSON-LD copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed — select and copy manually");
    }
  };
  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={copy}
        className="absolute right-2 top-2 h-7 gap-1 bg-background px-2 text-xs"
      >
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <pre className="max-h-72 overflow-auto rounded-lg border bg-slate-950 p-4 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function SchemaReport({ schema }: { schema: SchemaAuditResult }) {
  if (!schema) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Schema analysis unavailable.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Coverage summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Schema Coverage</div>
          <div className="mt-1 text-3xl font-bold">{schema.coveragePercent}%</div>
          <div className="text-xs text-muted-foreground">
            {schema.pagesWithSchema} of {schema.totalPages} pages have markup
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Detected Types</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {schema.detectedTypes.length > 0 ? (
              schema.detectedTypes.map((t) => (
                <Badge key={t} variant="outline" className="bg-green-50 text-green-700">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {t}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">None found</span>
            )}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Recommended Additions</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {schema.missingTypes.length > 0 ? (
              schema.missingTypes.map((t) => (
                <Badge key={t} variant="outline" className="bg-amber-50 text-amber-700">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {t}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">All key types present</span>
            )}
          </div>
        </Card>
      </div>

      {/* Recommendations with copy-paste JSON-LD */}
      {schema.recommendations.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Copy-Paste Structured Data</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Add these JSON-LD snippets inside a{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">
              &lt;script type="application/ld+json"&gt;
            </code>{" "}
            tag in the page <code className="rounded bg-muted px-1 py-0.5 text-xs">&lt;head&gt;</code>.
            Replace placeholder values with your real data.
          </p>
          {schema.recommendations.map((rec) => (
            <Card key={rec.type} className="space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{rec.type}</div>
                  <div className="text-sm text-muted-foreground">{rec.reason}</div>
                </div>
                <Badge variant="outline" className={priorityStyles[rec.priority]}>
                  {rec.priority}
                </Badge>
              </div>
              <CodeBlock code={rec.jsonLd} />
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-600" />
          <p className="font-medium">No critical schema gaps detected</p>
          <p className="text-sm text-muted-foreground">
            The key structured-data types for this site type are present.
          </p>
        </Card>
      )}
    </div>
  );
}
