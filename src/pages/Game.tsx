import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddPlayerDialog } from "@/components/AddPlayerDialog";
import { useGameStore } from "@/modules/game/store";
import { ArrowLeft, Plus, ScanLine } from "lucide-react";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function GamePage() {
  const navigate = useNavigate();
  const { players, init } = useGameStore();

  useEffect(() => {
    init();
  }, [init]);

  return (
    <div className="container mx-auto p-4 flex flex-col gap-4 min-h-screen">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-xl font-bold">Partie en cours</h2>
        <Button variant="ghost" size="icon">
          {/* Settings or Menu */}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* Player List / Scoreboard */}
        {players.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Aucun joueur ajouté.
            </CardContent>
          </Card>
        ) : (
          players.map((player) => (
            <Card key={player.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {player.name}
                </CardTitle>
                <div className="text-2xl font-bold">0</div>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  Score actuel
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="mt-auto grid gap-4">
        <Button size="lg" className="w-full" onClick={() => navigate("/scan")}>
          <ScanLine className="mr-2 h-4 w-4" />
          Scanner une manche
        </Button>
        <AddPlayerDialog>
          <Button variant="secondary" className="w-full">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter Joueur
          </Button>
        </AddPlayerDialog>
      </div>
    </div>
  );
}
