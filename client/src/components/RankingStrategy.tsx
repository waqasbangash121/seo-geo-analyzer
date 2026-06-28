import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, Clock, Target, Zap, TrendingUp, BookOpen } from "lucide-react";

interface Phase {
  id: string;
  name: string;
  duration: string;
  tasks: Task[];
  expectedResults: string[];
}

interface Task {
  id: string;
  title: string;
  description: string;
  completed: boolean;
}

const rankingPhases: Phase[] = [
  {
    id: "phase1",
    name: "Phase 1: Technical & Content Refinement",
    duration: "Weeks 1-2",
    tasks: [
      {
        id: "t1",
        title: "Optimize for Fan-out Queries",
        description: 'Create sections answering "How does semantic search work on Shopify?", "Best search app for 100k+ products", "Shopify keyword search vs vector search".',
        completed: false,
      },
      {
        id: "t2",
        title: "Enhance Schema Markup",
        description: "Add AggregateRating schema once you have customer reviews. Update SoftwareApplication schema with more detailed features.",
        completed: false,
      },
      {
        id: "t3",
        title: "Inject GEO Content Elements",
        description: "Add statistics, expert quotes, and technical depth to existing sections.",
        completed: false,
      },
    ],
    expectedResults: [
      "Improved AI engine crawlability",
      "Better structured data validation",
      "Increased citation-worthiness",
    ],
  },
  {
    id: "phase2",
    name: "Phase 2: Topical Authority (Content Clusters)",
    duration: "Weeks 3-6",
    tasks: [
      {
        id: "t4",
        title: "Create Blog Post 1",
        description: '"Why Keyword Search is Costing Your Shopify Store 15% in Revenue" - Focus on pain points and ROI.',
        completed: false,
      },
      {
        id: "t5",
        title: "Create Blog Post 2",
        description: '"The Merchant\'s Guide to Shopify Metafield Filtering" - Deep dive into technical implementation.',
        completed: false,
      },
      {
        id: "t6",
        title: "Create Case Study",
        description: '"How [Brand Name] Scaled to 200,000 Products with Hyper AI Search" - Real-world results and metrics.',
        completed: false,
      },
      {
        id: "t7",
        title: "Implement Internal Linking",
        description: "Link between main page and blog posts to establish topical clusters.",
        completed: false,
      },
    ],
    expectedResults: [
      "Established topical authority",
      "Increased backlink opportunities",
      "Better ranking for long-tail keywords",
    ],
  },
  {
    id: "phase3",
    name: "Phase 3: Off-Page & Social Proof",
    duration: "Weeks 7-12",
    tasks: [
      {
        id: "t8",
        title: "Shopify App Store Optimization",
        description: "Ensure your Shopify App Store listing links back to this landing page. Optimize app store description.",
        completed: false,
      },
      {
        id: "t9",
        title: "Get Listed on AI Directories",
        description: 'Submit to "There\'s An AI For That", "FutureTools", "AI Tool Hunt", and similar directories.',
        completed: false,
      },
      {
        id: "t10",
        title: "GitHub Repository",
        description: "If applicable, create or optimize a GitHub repo with high-quality documentation and examples.",
        completed: false,
      },
      {
        id: "t11",
        title: "Gather Social Proof",
        description: "Collect customer reviews and testimonials for AggregateRating schema.",
        completed: false,
      },
    ],
    expectedResults: [
      "High-quality backlinks from authority sites",
      "Increased brand mentions",
      "Better social proof signals",
    ],
  },
];

export default function RankingStrategy() {
  const [phases, setPhases] = useState<Phase[]>(rankingPhases);

  const toggleTask = (phaseId: string, taskId: string) => {
    setPhases(
      phases.map((phase) =>
        phase.id === phaseId
          ? {
              ...phase,
              tasks: phase.tasks.map((task) =>
                task.id === taskId ? { ...task, completed: !task.completed } : task
              ),
            }
          : phase
      )
    );
  };

  const getPhaseProgress = (phase: Phase) => {
    const completed = phase.tasks.filter((t) => t.completed).length;
    return Math.round((completed / phase.tasks.length) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Timeline Overview */}
      <Card className="p-6 border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold font-mono text-foreground">Google Ranking Roadmap</h3>
            <p className="text-sm text-muted-foreground mt-1">3-month strategy to achieve #1 ranking</p>
          </div>
          <Target className="w-6 h-6 text-primary/60" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Timeline</p>
            <p className="text-lg font-bold font-mono text-foreground">12 Weeks</p>
            <p className="text-xs text-muted-foreground mt-1">Expected to reach #1</p>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Content to Create</p>
            <p className="text-lg font-bold font-mono text-foreground">5+ Assets</p>
            <p className="text-xs text-muted-foreground mt-1">Blog posts, case studies, docs</p>
          </div>

          <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs font-medium text-muted-foreground uppercase mb-2">Backlinks Target</p>
            <p className="text-lg font-bold font-mono text-foreground">15-20</p>
            <p className="text-xs text-muted-foreground mt-1">From authority sites</p>
          </div>
        </div>
      </Card>

      {/* Phases */}
      <div className="space-y-4">
        {phases.map((phase, index) => {
          const progress = getPhaseProgress(phase);
          const completedTasks = phase.tasks.filter((t) => t.completed).length;

          return (
            <Card key={phase.id} className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
              <div className="p-6 border-b border-border/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 text-primary font-bold font-mono flex-shrink-0">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-lg">{phase.name}</h4>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{phase.duration}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-primary/10 text-primary">
                    {completedTasks}/{phase.tasks.length} Complete
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Progress</p>
                    <p className="text-sm font-bold text-primary">{progress}%</p>
                  </div>
                  <div className="w-full bg-border/50 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary to-primary/60 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h5 className="text-sm font-semibold text-foreground mb-3">Tasks</h5>
                  <div className="space-y-2">
                    {phase.tasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10 hover:border-primary/30 transition-all cursor-pointer"
                        onClick={() => toggleTask(phase.id, task.id)}
                      >
                        <div className="flex-shrink-0 mt-1">
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                              task.completed
                                ? "bg-green-500 border-green-500"
                                : "border-muted-foreground/30 hover:border-primary"
                            }`}
                          >
                            {task.completed && <CheckCircle2 className="w-4 h-4 text-white" />}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${task.completed ? "text-muted-foreground line-through" : "text-foreground"}`}>
                            {task.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border/30 pt-4">
                  <h5 className="text-sm font-semibold text-foreground mb-2">Expected Results</h5>
                  <ul className="space-y-1">
                    {phase.expectedResults.map((result, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <TrendingUp className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <span>{result}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Key Metrics to Monitor */}
      <Card className="p-6 border-border/50 bg-gradient-to-br from-primary/10 to-transparent backdrop-blur-sm">
        <div className="flex gap-4">
          <Zap className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
          <div>
            <h4 className="font-semibold text-foreground mb-3">Key Metrics to Monitor</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-foreground mb-1">Organic Metrics</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Keyword rankings (track top 20 keywords)</li>
                  <li>• Organic traffic growth</li>
                  <li>• Click-through rate (CTR)</li>
                  <li>• Average position in SERPs</li>
                </ul>
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-1">GEO Metrics</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Share of Model (SoM) across AI engines</li>
                  <li>• Citation frequency in AI responses</li>
                  <li>• Referral traffic from ChatGPT, Perplexity</li>
                  <li>• Brand mentions in AI-generated content</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button className="gap-2">
          <BookOpen className="w-4 h-4" />
          View Full Strategy Document
        </Button>
        <Button variant="outline" className="gap-2">
          <TrendingUp className="w-4 h-4" />
          Track Progress
        </Button>
      </div>
    </div>
  );
}
