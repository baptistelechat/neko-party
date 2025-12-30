import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ArrowLeft, Bot, GraduationCap, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ScanHeaderProps {
  isTrainingMode: boolean;
  onSetTrainingMode: (isTraining: boolean) => void;
  showDebug: boolean;
  onToggleDebug: (show: boolean) => void;
}

export function ScanHeader({
  isTrainingMode,
  onSetTrainingMode,
  showDebug,
  onToggleDebug,
}: ScanHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="absolute top-4 left-4 z-10 flex gap-2 w-[calc(100%-2rem)] justify-between pointer-events-none">
      <div className="pointer-events-auto">
        <Button
          variant="ghost"
          size="icon"
          className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
      </div>

      <div className="flex gap-2 pointer-events-auto">
        {/* LIVE MODE CONTROLS */}
        {!isTrainingMode && (
          <>
            <Toggle
              pressed={showDebug}
              onPressedChange={onToggleDebug}
              variant="outline"
              size="sm"
              className="text-white bg-black/20 backdrop-blur-sm hover:bg-black/40 data-[state=on]:bg-green-500 data-[state=on]:text-white border-none"
            >
              <Bot className="h-4 w-4" />
            </Toggle>

            <Button
              variant="ghost"
              size="sm"
              className="text-white bg-black/20 backdrop-blur-sm hover:bg-blue-600/50"
              onClick={() => onSetTrainingMode(true)}
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              Train
            </Button>
          </>
        )}

        {/* TRAINING MODE CONTROLS */}
        {isTrainingMode && (
          <Button
            variant="ghost"
            size="sm"
            className="text-white bg-black/20 backdrop-blur-sm hover:bg-green-600/50"
            onClick={() => onSetTrainingMode(false)}
          >
            <Zap className="h-4 w-4 mr-2 fill-current" />
            Live
          </Button>
        )}
      </div>
    </div>
  );
}
