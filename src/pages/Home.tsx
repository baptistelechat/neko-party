import { useGameStore } from "@/modules/game/store";
import { Button } from "@/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card";
import { Cat, History, Play } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const { init, players } = useGameStore();

  useEffect(() => {
    init();
  }, [init]);

  const handleNewGame = () => {
    navigate("/game");
  };

  return (
    <div className="container mx-auto p-4 flex flex-col items-center gap-8 min-h-screen justify-center">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
            <Cat className="w-24 h-24 text-primary animate-bounce" />
        </div>
        <h1 className="text-4xl font-bold tracking-tight">Neko Party</h1>
        <p className="text-muted-foreground text-lg">
          Ton compagnon de jeu pour Skyjo ! 🐱
        </p>
      </div>

      <div className="grid gap-4 w-full max-w-sm">
        <Button size="lg" className="w-full text-lg h-14" onClick={handleNewGame}>
          <Play className="mr-2 h-6 w-6" />
          Nouvelle Partie
        </Button>
        
        <Button variant="outline" size="lg" className="w-full text-lg h-14" onClick={() => navigate("/history")}>
          <History className="mr-2 h-6 w-6" />
          Historique
        </Button>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-center">Statistiques Rapides</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{players.length}</div>
            <div className="text-xs text-muted-foreground">Joueurs connus</div>
          </div>
          <div>
            <div className="text-2xl font-bold">-</div>
            <div className="text-xs text-muted-foreground">Parties jouées</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
