import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart3, TrendingUp, Zap, BookOpen, Users, Link2 } from "lucide-react";

interface GEOStrategy {
  id: string;
  name: string;
  description: string;
  impact: string;
  implementation: string;
  status: "not-started" | "in-progress" | "completed";
  priority: "high" | "medium" | "low";
}

const geoStrategies: GEOStrategy[] = [
  {
    id: "statistics",
    name: "Add Statistics & Data",
    description: "Include verified statistics and data points to make content more citation-worthy.",
    impact: "+37% Visibility",
    implementation: "Inject 3-5 verified statistics into Features and Problem sections.",
    status: "not-started",
    priority: "high",
  },
  {
    id: "expert-quotes",
    name: "Include Expert Quotations",
    description: "Add quotes from recognized experts with proper attribution.",
    impact: "+30% Visibility",
    implementation: 'Add a quote from a CTO or Shopify expert: "Vector search is no longer optional for high-SKU brands."',
    status: "not-started",
    priority: "high",
  },
  {
    id: "technical-depth",
    name: "Use Precise Technical Terminology",
    description: "Mention specific technologies and technical terms appropriately.",
    impact: "+28% Visibility",
    implementation: 'Mention "Pinecone vector database" or "OpenAI embeddings" in descriptions.',
    status: "not-started",
    priority: "high",
  },
  {
    id: "cite-sources",
    name: "Cite Authoritative Sources",
    description: "Link to external studies and official documentation.",
    impact: "+40% Visibility",
    implementation: "Link to Baymard Institute studies on search usability.",
    status: "not-started",
    priority: "high",
  },
  {
    id: "clear-definitions",
    name: "Create Clear Definitions",
    description: "Provide explicit definitions for key terms near the top of content.",
    impact: "+25% Visibility",
    implementation: "Define 'Semantic Search', 'Vector Embeddings', and 'Metafield Filtering' clearly.",
    status: "not-started",
    priority: "medium",
  },
  {
    id: "structured-headings",
    name: "Structure Content with Clear Headings",
    description: "Use descriptive headings that match common query patterns.",
    impact: "+20% Visibility",
    implementation: 'Use "How does semantic search work?" instead of "Overview".',
    status: "not-started",
    priority: "medium",
  },
  {
    id: "faq-sections",
    name: "Implement FAQ Sections",
    description: "Create comprehensive FAQ sections with direct Q&A pairs.",
    impact: "+22% Visibility",
    implementation: "Expand FAQ section with 10-15 questions relevant to merchants.",
    status: "in-progress",
    priority: "medium",
  },
  {
    id: "tables-data",
    name: "Use Tables for Comparative Data",
    description: "Present comparative information in structured tables.",
    impact: "+18% Visibility",
    implementation: "Create comparison tables: Shopify native search vs. Hyper AI Search.",
    status: "not-started",
    priority: "medium",
  },
  {
    id: "content-freshness",
    name: "Maintain Content Freshness",
    description: "Update content regularly and display 'last updated' dates.",
    impact: "+15% Visibility",
    implementation: "Add lastModified metadata and display on page.",
    status: "not-started",
    priority: "low",
  },
  {
    id: "topical-depth",
    name: "Build Topical Depth",
    description: "Create comprehensive coverage with interlinked content.",
    impact: "+32% Visibility",
    implementation: "Create 3 supporting blog posts to build topical authority.",
    status: "not-started",
    priority: "high",
  },
];

export default function GEOOptimization() {
  const [strategies, setStrategies] = useState<GEOStrategy[]>(geoStrategies);

  const updateStatus = (id: string, newStatus: "not-started" | "in-progress" | "completed") => {
    setStrategies(strategies.map((s) => (s.id === id ? { ...s, status: newStatus } : s)));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500/20 text-green-300";
      case "in-progress":
        return "bg-blue-500/20 text-blue-300";
      case "not-started":
        return "bg-gray-500/20 text-gray-300";
      default:
        return "";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-300";
      case "medium":
        return "bg-yellow-500/20 text-yellow-300";
      case "low":
        return "bg-blue-500/20 text-blue-300";
      default:
        return "";
    }
  };

  const completedCount = strategies.filter((s) => s.status === "completed").length;
  const inProgressCount = strategies.filter((s) => s.status === "in-progress").length;
  const totalStrategies = strategies.length;
  const progressPercentage = Math.round(((completedCount + inProgressCount * 0.5) / totalStrategies) * 100);

  return (
    <div className="space-y-6">
      {/* GEO Progress Overview */}
      <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold font-mono text-foreground">GEO Implementation Progress</h3>
            <p className="text-sm text-muted-foreground mt-1">Track your generative engine optimization efforts</p>
          </div>
          <Zap className="w-6 h-6 text-primary/60" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Completed</p>
            <p className="text-2xl font-bold font-mono text-green-400">{completedCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">In Progress</p>
            <p className="text-2xl font-bold font-mono text-blue-400">{inProgressCount}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Total Progress</p>
            <p className="text-2xl font-bold font-mono text-primary">{progressPercentage}%</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Overall Progress</p>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </Card>

      {/* GEO Strategies Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold font-mono text-foreground">Optimization Strategies</h3>

        <div className="grid grid-cols-1 gap-4">
          {strategies.map((strategy) => (
            <Card key={strategy.id} className="p-5 border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold text-foreground">{strategy.name}</h4>
                    <Badge variant="outline" className={`text-xs ${getPriorityColor(strategy.priority)}`}>
                      {strategy.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{strategy.description}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <div className="flex items-center gap-1 mb-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">{strategy.impact}</span>
                  </div>
                  <Badge variant="outline" className={`text-xs ${getStatusColor(strategy.status)}`}>
                    {strategy.status}
                  </Badge>
                </div>
              </div>

              <div className="bg-primary/5 rounded-md p-3 mb-4 border border-primary/10">
                <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Implementation</p>
                <p className="text-sm text-foreground">{strategy.implementation}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={strategy.status === "not-started" ? "outline" : "ghost"}
                  onClick={() => updateStatus(strategy.id, "not-started")}
                  className="text-xs"
                >
                  Not Started
                </Button>
                <Button
                  size="sm"
                  variant={strategy.status === "in-progress" ? "outline" : "ghost"}
                  onClick={() => updateStatus(strategy.id, "in-progress")}
                  className="text-xs"
                >
                  In Progress
                </Button>
                <Button
                  size="sm"
                  variant={strategy.status === "completed" ? "outline" : "ghost"}
                  onClick={() => updateStatus(strategy.id, "completed")}
                  className="text-xs"
                >
                  Completed
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* GEO Tips */}
      <Card className="p-6 border-border/50 bg-gradient-to-br from-primary/10 to-transparent backdrop-blur-sm">
        <div className="flex gap-4">
          <BookOpen className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-foreground mb-2">GEO Best Practices</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• AI engines prioritize content that cites sources, includes statistics, and quotes experts.</li>
              <li>• Use technical terminology appropriately to signal expertise and authority.</li>
              <li>• Maintain content freshness with regular updates and visible "last updated" dates.</li>
              <li>• Build topical authority through interlinked content clusters, not isolated pages.</li>
              <li>• Monitor your "Share of Model" by asking AI engines about your topic regularly.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
