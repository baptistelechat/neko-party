import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ArrowLeft, Bot, GraduationCap, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ScanHeaderProps {
  isTrainingMode: boolean;
  onToggleTrainingMode: () => void;
  showRobotVision: boolean;
  onToggleRobotVision: (show: boolean) => void;
}

export function ScanHeader({
  isTrainingMode,
  onToggleTrainingMode,
  showRobotVision,
  onToggleRobotVision,
}: ScanHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="absolute top-4 left-4 z-10 flex gap-2">
      <Button
        variant="ghost"
        size="icon"
        className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-6 w-6" />
      </Button>

      {/* Always Live Indicator */}
      <div className="flex items-center px-3 py-1 rounded-md bg-black/20 backdrop-blur-sm text-white text-sm font-medium border border-white/10">
        <Zap className="h-4 w-4 mr-2 text-green-400 fill-current animate-pulse" />
        Live
      </div>

      {!isTrainingMode && (
        <Toggle
          pressed={showRobotVision}
          onPressedChange={onToggleRobotVision}
          variant="outline"
          size="sm"
          className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40 data-[state=on]:bg-green-500 data-[state=on]:text-white border-none"
        >
          <Bot className="h-4 w-4" />
        </Toggle>
      )}

      <Button
        variant={isTrainingMode ? "secondary" : "ghost"}
        size="sm"
        className={`${
          isTrainingMode
            ? "bg-blue-500 text-white hover:bg-blue-600"
            : "text-white bg-black/20"
        } backdrop-blur-sm`}
        onClick={onToggleTrainingMode}
      >
        <GraduationCap
          className={`h-4 w-4 mr-2 ${isTrainingMode ? "fill-current" : ""}`}
        />
        {isTrainingMode ? "Train ON" : "Train OFF"}
      </Button>
    </div>
  );
}
