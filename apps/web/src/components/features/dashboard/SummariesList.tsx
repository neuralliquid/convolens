import { SummaryCard } from "@ui/common/summary-card"
import { Summary } from "@utils/dashboard-utils"
import { calculateScores } from "@utils/scoring"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import { useState, useEffect } from "react"

interface SummariesListProps {
  summaries: Summary[]
  onDelete: (id: string) => void
  isScoring: boolean
}

const SummaryScore = ({ score }: { score: number }) => {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setProgress(score), 300)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-muted-foreground">Summary Quality</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Based on relevance, completeness, and clarity</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  )
}

export const SummariesList = ({ summaries, onDelete, isScoring }: SummariesListProps) => {
  if (summaries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <h3 className="text-lg font-medium">No summaries found</h3>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search or filter criteria
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {summaries.map((summary) => {
        const scores = calculateScores(summary)
        const overallScore = Math.round(
          (scores.relevance + scores.completeness + scores.clarity) / 3
        )
        
        return (
          <SummaryCard
            key={summary.id}
            id={summary.id}
            title={summary.title}
            content={summary.content}
            groupName={summary.groupName}
            date={new Date(summary.date)}
            messageCount={summary.messageCount}
            participants={summary.participants}
            platform={summary.platform}
            type={summary.type}
            isRead={summary.isRead}
            tags={summary.tags}
            onDelete={() => onDelete(summary.id)}
            footer={
              isScoring ? (
                <SummaryScore score={overallScore} />
              ) : null
            }
          />
        )
      })}
    </div>
  )
}
